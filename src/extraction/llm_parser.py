"""
LLM-based PDF parser for question extraction.

Uses Groq (Llama 4 Scout) to intelligently parse PDFs and extract questions.
More robust than regex-based parsing, handles varied formats.
"""
import json
import re
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from loguru import logger

from src.core.exceptions import ExtractionError
from src.extraction.pdf_detector import inferir_banca_cargo_ano
from src.llm.llm_orchestrator import LLMOrchestrator


# System prompt for question extraction
EXTRACTION_SYSTEM_PROMPT = """Voce e um especialista em extrair questoes de provas de concurso de PDFs brasileiros.

Sua tarefa e analisar o texto extraido de um PDF de prova e identificar TODAS as questoes.

REGRAS IMPORTANTES:
1. Cada questao tem: numero, enunciado, 5 alternativas (A-E), e gabarito (resposta correta)
2. O gabarito pode aparecer como "(Correta: X)" proximo ao numero da questao ou no final
3. Identifique a DISCIPLINA de cada questao baseado nos cabecalhos de secao (ex: "Lingua Portuguesa", "Matematica", etc)
4. Se uma questao estiver marcada como ANULADA, marque anulada=true
5. Extraia o enunciado COMPLETO, incluindo textos base quando aplicavel
6. NAO invente questoes - extraia apenas o que esta no texto
7. Mantenha a formatacao original do enunciado e alternativas

FORMATO DE SAIDA (JSON):
{
  "questoes": [
    {
      "numero": 1,
      "disciplina": "Lingua Portuguesa",
      "enunciado": "Texto completo do enunciado...",
      "alternativas": {
        "A": "Texto da alternativa A",
        "B": "Texto da alternativa B",
        "C": "Texto da alternativa C",
        "D": "Texto da alternativa D",
        "E": "Texto da alternativa E"
      },
      "gabarito": "C",
      "anulada": false
    }
  ],
  "total_questoes": 60,
  "disciplinas_encontradas": ["Lingua Portuguesa", "Matematica", "Conhecimentos Especificos"]
}

IMPORTANTE: Retorne APENAS o JSON, sem explicacoes ou texto adicional."""


def extract_questions_with_llm(
    pdf_path: str | Path,
    llm: Optional[LLMOrchestrator] = None,
    max_pages: Optional[int] = None,
) -> dict:
    """
    Extract questions from PDF using LLM.

    Args:
        pdf_path: Path to PDF file
        llm: LLM orchestrator instance (creates one if not provided)
        max_pages: Maximum pages to process (None = all)

    Returns:
        dict with metadados and questoes

    Raises:
        ExtractionError: If extraction fails
    """
    try:
        pdf_path = Path(pdf_path)
        logger.info(f"Extracting questions with LLM from: {pdf_path}")

        # Initialize LLM if not provided
        if llm is None:
            llm = LLMOrchestrator()

        # Extract text from PDF
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        pages_to_process = min(total_pages, max_pages) if max_pages else total_pages

        full_text = ""
        for i, page in enumerate(doc):
            if i >= pages_to_process:
                break
            page_text = page.get_text()
            # Clean up the pcimarkpci watermark
            page_text = re.sub(r'pcimarkpci\s+\S+', '', page_text)
            page_text = re.sub(r'www\.pciconcursos\.com\.br', '', page_text)
            full_text += f"\n--- PAGINA {i+1} ---\n{page_text}"

        doc.close()

        # Infer metadata
        metadados = inferir_banca_cargo_ano(pdf_path, full_text[:2000])

        logger.info(f"Extracted {len(full_text)} chars from {pages_to_process} pages")
        logger.info(f"Sending to LLM for question extraction...")

        # Build prompt
        user_prompt = f"""Analise o texto abaixo extraido de uma prova de concurso e extraia TODAS as questoes.

TEXTO DO PDF:
{full_text}

Extraia todas as questoes no formato JSON especificado. Lembre-se de identificar:
- Numero da questao
- Disciplina (baseado nos cabecalhos de secao)
- Enunciado completo
- Todas as 5 alternativas (A-E)
- Gabarito (resposta correta)
- Se esta anulada"""

        # Call LLM
        result = llm.generate(
            prompt=user_prompt,
            system_prompt=EXTRACTION_SYSTEM_PROMPT,
            temperature=0.1,
            max_tokens=8192,  # Groq limit for Llama 4 Scout
        )

        response_text = result.get("content", "") or result.get("text", "")
        logger.debug(f"LLM response length: {len(response_text)} chars")

        # Parse JSON from response
        questoes_data = parse_llm_response(response_text)

        if not questoes_data:
            logger.error("Failed to parse LLM response as JSON")
            raise ExtractionError("LLM returned invalid JSON response")

        questoes = questoes_data.get("questoes", [])
        logger.info(f"LLM extracted {len(questoes)} questions")

        # Add metadata to each question
        for q in questoes:
            q["fonte"] = "LLM_extraction"
            q["status_extracao"] = "ok"
            q["alertas"] = []

            # Validate question
            if len(q.get("enunciado", "")) < 10:
                q["alertas"].append("Enunciado muito curto")
                q["status_extracao"] = "revisar_manual"

            if len(q.get("alternativas", {})) != 5:
                q["alertas"].append(f"Numero de alternativas: {len(q.get('alternativas', {}))}")
                q["status_extracao"] = "revisar_manual"

        return {
            "metadados": metadados,
            "questoes": questoes,
            "llm_info": {
                "provider": result.get("provider"),
                "model": result.get("model"),
                "tokens": result.get("tokens", {}),
            },
            "disciplinas_encontradas": questoes_data.get("disciplinas_encontradas", []),
        }

    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")
        raise ExtractionError(f"LLM extraction failed: {e}")


def parse_llm_response(response_text: str) -> Optional[dict]:
    """
    Parse JSON from LLM response, handling markdown code blocks.

    Args:
        response_text: Raw LLM response

    Returns:
        Parsed dict or None if parsing fails
    """
    # Try direct JSON parse first
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        pass

    # Try to extract from markdown code block
    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', response_text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try to find JSON object in text
    json_match = re.search(r'\{[\s\S]*"questoes"[\s\S]*\}', response_text)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    logger.error(f"Could not parse JSON from response: {response_text[:500]}...")
    return None


def extract_questions_chunked(
    pdf_path: str | Path,
    llm: Optional[LLMOrchestrator] = None,
    pages_per_chunk: int = 4,
) -> dict:
    """
    Extract questions from large PDFs by processing in chunks.

    Useful for very large PDFs that might exceed token limits.

    Args:
        pdf_path: Path to PDF file
        llm: LLM orchestrator instance
        pages_per_chunk: Pages to process per LLM call

    Returns:
        dict with metadados and questoes
    """
    try:
        pdf_path = Path(pdf_path)
        logger.info(f"Extracting questions in chunks from: {pdf_path}")

        if llm is None:
            llm = LLMOrchestrator()

        doc = fitz.open(pdf_path)
        total_pages = len(doc)

        # Infer metadata from first pages
        first_text = ""
        for i in range(min(3, total_pages)):
            first_text += doc[i].get_text()
        metadados = inferir_banca_cargo_ano(pdf_path, first_text)

        doc.close()

        all_questoes = []
        all_disciplinas = set()
        llm_info = {}

        # Process in chunks
        for start_page in range(0, total_pages, pages_per_chunk):
            end_page = min(start_page + pages_per_chunk, total_pages)
            logger.info(f"Processing pages {start_page+1}-{end_page}/{total_pages}")

            # Extract chunk
            doc = fitz.open(pdf_path)
            chunk_text = ""
            for i in range(start_page, end_page):
                page_text = doc[i].get_text()
                page_text = re.sub(r'pcimarkpci\s+\S+', '', page_text)
                page_text = re.sub(r'www\.pciconcursos\.com\.br', '', page_text)
                chunk_text += f"\n--- PAGINA {i+1} ---\n{page_text}"
            doc.close()

            # Skip mostly empty chunks
            if len(chunk_text.strip()) < 500:
                logger.debug(f"Skipping near-empty chunk (pages {start_page+1}-{end_page})")
                continue

            # Call LLM for this chunk
            user_prompt = f"""Analise o texto abaixo (paginas {start_page+1}-{end_page} de uma prova) e extraia as questoes.

TEXTO:
{chunk_text}

Extraia todas as questoes encontradas no formato JSON."""

            result = llm.generate(
                prompt=user_prompt,
                system_prompt=EXTRACTION_SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=8000,
            )

            llm_info = {
                "provider": result.get("provider"),
                "model": result.get("model"),
            }

            chunk_data = parse_llm_response(result.get("content", "") or result.get("text", ""))
            if chunk_data:
                chunk_questoes = chunk_data.get("questoes", [])
                for q in chunk_questoes:
                    q["fonte"] = "LLM_extraction"
                    q["status_extracao"] = "ok"
                    q["alertas"] = []
                all_questoes.extend(chunk_questoes)
                all_disciplinas.update(chunk_data.get("disciplinas_encontradas", []))

        # Deduplicate by question number
        seen_numbers = set()
        unique_questoes = []
        for q in all_questoes:
            num = q.get("numero")
            if num not in seen_numbers:
                seen_numbers.add(num)
                unique_questoes.append(q)

        logger.info(f"Total extracted: {len(unique_questoes)} unique questions")

        return {
            "metadados": metadados,
            "questoes": unique_questoes,
            "llm_info": llm_info,
            "disciplinas_encontradas": list(all_disciplinas),
        }

    except Exception as e:
        logger.error(f"Chunked extraction failed: {e}")
        raise ExtractionError(f"Chunked extraction failed: {e}")
