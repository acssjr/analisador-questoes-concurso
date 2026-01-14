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


def _is_incomplete_question(q: dict) -> bool:
    """Check if a question has incomplete data (missing/empty alternatives)."""
    alternativas = q.get("alternativas", {})

    # No alternatives at all
    if not alternativas:
        return True

    # Count non-empty alternatives
    non_empty = sum(1 for v in alternativas.values() if v and str(v).strip())

    # Should have at least 4 alternatives with content
    if non_empty < 4:
        return True

    # Enunciado too short (likely truncated)
    enunciado = q.get("enunciado", "")
    if len(enunciado) < 20:
        return True

    return False


def _repair_incomplete_questions(
    all_questions: list[dict],
    incomplete: list[dict],
    pdf_path: Path,
    llm: "LLMOrchestrator",
) -> list[dict]:
    """
    Attempt to repair incomplete questions by re-extracting with focused prompts.

    Strategy:
    1. For each incomplete question, extract text from all pages
    2. Ask LLM to find and complete that specific question
    3. Merge the repaired data back
    """
    import fitz

    # Extract all text with page markers for reference
    doc = fitz.open(pdf_path)
    all_text = ""
    for i, page in enumerate(doc):
        page_text = page.get_text()
        page_text = re.sub(r'pcimarkpci\s+\S+', '', page_text)
        page_text = re.sub(r'www\.pciconcursos\.com\.br', '', page_text)
        all_text += f"\n--- PAGINA {i+1} ---\n{page_text}"
    doc.close()

    repaired_map = {}

    for q in incomplete:
        numero = q.get("numero")
        enunciado_partial = q.get("enunciado", "")[:100]

        logger.info(f"Repairing question {numero}: {enunciado_partial}...")

        repair_prompt = f"""Encontre e extraia a questao {numero} do texto abaixo.

Esta questao pode estar INCOMPLETA ou com alternativas faltando.
Procure pelo numero da questao e extraia:
- Enunciado COMPLETO
- TODAS as alternativas (A, B, C, D, E se houver)
- Gabarito (resposta correta)

TEXTO DO PDF:
{all_text}

Retorne APENAS um JSON com a questao completa:
{{
  "numero": {numero},
  "disciplina": "...",
  "enunciado": "texto completo do enunciado",
  "alternativas": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
  "gabarito": "X"
}}"""

        try:
            result = llm.generate(
                prompt=repair_prompt,
                system_prompt="Voce e um especialista em extrair questoes de provas. Retorne APENAS JSON valido.",
                temperature=0.1,
                max_tokens=2000,
            )

            response = result.get("content", "") or result.get("text", "")
            repaired_data = parse_llm_response(response)

            if repaired_data and "numero" in repaired_data:
                # Single question repair
                repaired_q = repaired_data
            elif repaired_data and "questoes" in repaired_data:
                # Wrapped in questoes array
                questoes = repaired_data.get("questoes", [])
                repaired_q = next((q for q in questoes if q.get("numero") == numero), None)
            else:
                repaired_q = None

            if repaired_q and not _is_incomplete_question(repaired_q):
                repaired_q["fonte"] = "LLM_repair"
                repaired_q["status_extracao"] = "repaired"
                repaired_map[numero] = repaired_q
                logger.info(f"Successfully repaired question {numero}")
            else:
                logger.warning(f"Could not repair question {numero}")

        except Exception as e:
            logger.error(f"Repair failed for question {numero}: {e}")

    # Merge repaired questions back
    result = []
    for q in all_questions:
        num = q.get("numero")
        if num in repaired_map:
            result.append(repaired_map[num])
        else:
            result.append(q)

    repaired_count = len(repaired_map)
    if repaired_count > 0:
        logger.info(f"Repaired {repaired_count}/{len(incomplete)} incomplete questions")

    return result


def extract_questions_chunked(
    pdf_path: str | Path,
    llm: Optional[LLMOrchestrator] = None,
    pages_per_chunk: int = 4,
    overlap_pages: int = 1,
) -> dict:
    """
    Extract questions from large PDFs by processing in chunks with overlap.

    Uses overlapping pages between chunks to handle questions that span
    page boundaries (e.g., enunciado on page 4, alternatives on page 5).

    Args:
        pdf_path: Path to PDF file
        llm: LLM orchestrator instance
        pages_per_chunk: Pages to process per LLM call
        overlap_pages: Number of pages to overlap between chunks (prevents split questions)

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

        # Calculate effective stride (pages to advance between chunks)
        stride = pages_per_chunk - overlap_pages
        if stride < 1:
            stride = 1

        # Process in overlapping chunks
        start_page = 0
        while start_page < total_pages:
            end_page = min(start_page + pages_per_chunk, total_pages)
            logger.info(f"Processing pages {start_page+1}-{end_page}/{total_pages} (overlap={overlap_pages})")

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

            # Advance by stride (not full chunk size) to create overlap
            start_page += stride

        # Deduplicate by question number, preferring more complete versions
        questoes_by_number: dict[int, dict] = {}
        for q in all_questoes:
            num = q.get("numero")
            if num is None:
                continue

            # Score question completeness (more alternatives, longer enunciado = better)
            alternativas = q.get("alternativas", {})
            enunciado = q.get("enunciado", "")
            completeness = len(alternativas) * 10 + len(enunciado)

            existing = questoes_by_number.get(num)
            if existing is None:
                questoes_by_number[num] = q
                q["_completeness"] = completeness
            else:
                # Keep the more complete version
                if completeness > existing.get("_completeness", 0):
                    questoes_by_number[num] = q
                    q["_completeness"] = completeness

        # Clean up temp field and sort by number
        unique_questoes = []
        for num in sorted(questoes_by_number.keys()):
            q = questoes_by_number[num]
            q.pop("_completeness", None)
            unique_questoes.append(q)

        logger.info(f"Total extracted: {len(unique_questoes)} unique questions (from {len(all_questoes)} with overlap)")

        # Detect and retry incomplete questions (empty alternatives)
        incomplete_questions = [
            q for q in unique_questoes
            if _is_incomplete_question(q)
        ]

        if incomplete_questions:
            logger.warning(f"Found {len(incomplete_questions)} incomplete questions, attempting repair...")
            unique_questoes = _repair_incomplete_questions(
                unique_questoes, incomplete_questions, pdf_path, llm
            )

        return {
            "metadados": metadados,
            "questoes": unique_questoes,
            "llm_info": llm_info,
            "disciplinas_encontradas": list(all_disciplinas),
        }

    except Exception as e:
        logger.error(f"Chunked extraction failed: {e}")
        raise ExtractionError(f"Chunked extraction failed: {e}")
