"""
LLM-based prova extractor - extracts questions from any PDF format using LLM
"""
import json
import re
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from loguru import logger

from src.core.exceptions import ExtractionError
from src.llm.llm_orchestrator import LLMOrchestrator


def detect_questions_start_page(pdf_path: str | Path) -> int:
    """
    Detect which page the questions start on by looking for patterns.

    Typically:
    - Page 1: Cover page with instructions
    - Page 2: Scratch paper (RASCUNHO)
    - Page 3+: Questions start

    Returns:
        int: 0-indexed page number where questions start
    """
    try:
        doc = fitz.open(pdf_path)

        for page_num in range(min(5, len(doc))):
            text = doc[page_num].get_text().lower()

            # Look for question patterns
            has_questao = bool(re.search(r'quest[aã]o\s*0?1\b', text))
            has_alternativas = bool(re.search(r'\([a-e]\)', text))

            # Skip pages that are clearly not questions
            is_cover = 'leia atentamente' in text or 'instruções' in text
            is_rascunho = 'rascunho' in text and len(text) < 500

            if has_questao and has_alternativas and not is_rascunho:
                logger.info(f"Questions detected starting at page {page_num + 1}")
                doc.close()
                return page_num

        doc.close()
        # Default: start from page 3 (index 2) for typical prova format
        return 2

    except Exception as e:
        logger.warning(f"Error detecting start page: {e}, defaulting to page 3")
        return 2


def extract_prova_text(pdf_path: str | Path, max_pages: int = 50) -> str:
    """
    Extract text from prova PDF

    Args:
        pdf_path: Path to PDF file
        max_pages: Maximum pages to extract

    Returns:
        str: Extracted text
    """
    try:
        doc = fitz.open(pdf_path)
        text = ""

        for page_num in range(min(max_pages, len(doc))):
            text += f"\n--- PÁGINA {page_num + 1} ---\n"
            text += doc[page_num].get_text()

        doc.close()
        logger.debug(f"Extracted {len(text)} chars from prova PDF ({min(max_pages, len(doc))} pages)")

        return text

    except Exception as e:
        logger.error(f"Failed to extract prova text: {e}")
        raise ExtractionError(f"Prova text extraction failed: {e}")


def extract_questoes_with_llm(
    pdf_path: str | Path,
    taxonomia: Optional[dict] = None,
    batch_size: int = 3  # Reduced to avoid truncation
) -> dict:
    """
    Extract questions from prova PDF using LLM

    This function extracts questions in batches to handle large provas.
    It automatically skips cover pages and scratch paper.

    Args:
        pdf_path: Path to prova PDF
        taxonomia: Optional taxonomia from edital for classification hints
        batch_size: Number of pages to process per LLM call (reduced for accuracy)

    Returns:
        dict: {
            "metadados": {banca, cargo, ano},
            "questoes": list of questão dicts
        }
    """
    try:
        doc = fitz.open(pdf_path)
        total_pages = len(doc)

        # Detect where questions actually start (skip cover/rascunho)
        start_page = detect_questions_start_page(pdf_path)
        logger.info(f"Extracting questions from prova: {pdf_path} ({total_pages} pages, starting at page {start_page + 1})")

        all_questoes = []
        metadados = {"banca": None, "cargo": None, "ano": None}

        # Extract metadata from first page (cover)
        if start_page > 0:
            cover_text = doc[0].get_text()
            metadados = _extract_metadata_from_cover(cover_text)

        # Process in batches starting from questions page
        for batch_start in range(start_page, total_pages, batch_size):
            batch_end = min(batch_start + batch_size, total_pages)

            # Skip redação/essay pages at the end
            batch_text = ""
            for page_num in range(batch_start, batch_end):
                page_text = doc[page_num].get_text()
                # Skip essay pages
                if 'REDAÇÃO' in page_text.upper() and 'dissertativo' in page_text.lower():
                    logger.info(f"Skipping essay section at page {page_num + 1}")
                    continue
                batch_text += f"\n--- PÁGINA {page_num + 1} ---\n"
                batch_text += page_text

            if not batch_text.strip():
                continue

            logger.info(f"Processing pages {batch_start + 1}-{batch_end} of {total_pages}")

            # Extract questions from this batch
            batch_result = _extract_batch_with_llm(
                batch_text,
                batch_start + 1,
                taxonomia,
                is_first_batch=(batch_start == start_page)
            )

            all_questoes.extend(batch_result.get("questoes", []))

        doc.close()

        # Deduplicate questions by number
        seen_numbers = set()
        unique_questoes = []
        for q in all_questoes:
            if q.get("numero") not in seen_numbers:
                seen_numbers.add(q.get("numero"))
                unique_questoes.append(q)

        logger.info(f"Extracted {len(unique_questoes)} unique questions from prova")

        return {
            "metadados": metadados,
            "questoes": unique_questoes
        }

    except Exception as e:
        logger.error(f"Failed to extract questions with LLM: {e}")
        raise ExtractionError(f"LLM question extraction failed: {e}")


def _extract_metadata_from_cover(cover_text: str) -> dict:
    """Extract metadata from cover page using regex patterns."""
    metadados = {"banca": None, "cargo": None, "ano": None}

    # Common bancas
    bancas = ["IDCAP", "FCC", "CESPE", "CEBRASPE", "VUNESP", "FGV", "CESGRANRIO",
              "QUADRIX", "IBFC", "AOCP", "FUNDATEC", "IADES", "FUNDEP"]
    for banca in bancas:
        if banca.upper() in cover_text.upper():
            metadados["banca"] = banca
            break

    # Extract year
    year_match = re.search(r'(20\d{2})', cover_text)
    if year_match:
        metadados["ano"] = int(year_match.group(1))

    # Extract cargo (common patterns)
    cargo_patterns = [
        r'(?:cargo|função)[:\s]*([^\n]+)',
        r'técnico[^\n]*',
        r'analista[^\n]*',
    ]
    for pattern in cargo_patterns:
        match = re.search(pattern, cover_text, re.IGNORECASE)
        if match:
            cargo = match.group(1) if '(' in pattern else match.group(0)
            metadados["cargo"] = cargo.strip()[:100]  # Limit length
            break

    return metadados


def _extract_batch_with_llm(
    text: str,
    start_page: int,
    taxonomia: Optional[dict] = None,
    is_first_batch: bool = False
) -> dict:
    """
    Extract questions from a batch of text using LLM

    Args:
        text: Text content to analyze
        start_page: Starting page number for reference
        taxonomia: Optional taxonomia for classification hints
        is_first_batch: Whether this is the first batch (extract metadata)

    Returns:
        dict with metadados and questoes
    """
    # Build taxonomia hint if available
    taxonomia_hint = ""
    if taxonomia and taxonomia.get("disciplinas"):
        disciplinas_list = [d["nome"] for d in taxonomia["disciplinas"]]
        taxonomia_hint = f"""
DISCIPLINAS DO EDITAL (use para classificar as questões):
{', '.join(disciplinas_list)}
"""

    prompt = f"""Extraia TODAS as questões deste trecho de prova de concurso.

TEXTO DA PROVA:
{text[:45000]}
{taxonomia_hint}
PADRÕES COMUNS DE QUESTÕES:
- "Questão 01", "Questão 1", "01.", "1."
- Gabarito pode aparecer como "(Correta: B)" ou "Resposta: B"
- Alternativas: "(A)", "(B)", "(C)", "(D)", "(E)"
- Disciplinas aparecem como títulos: "Língua Portuguesa", "Matemática", etc.
- Questões anuladas: "(Questão anulada)"

EXTRAIA PARA CADA QUESTÃO:
1. numero: Número da questão (inteiro)
2. disciplina: Disciplina (do título da seção ou infira pelo conteúdo)
3. assunto: Assunto ESPECÍFICO da questão baseado no conteúdo. Exemplos:
   - Língua Portuguesa: "Interpretação de Texto", "Sintaxe", "Morfologia", "Semântica", "Pontuação", "Concordância", "Regência", "Crase", "Figuras de Linguagem"
   - Matemática: "Porcentagem", "Razão e Proporção", "Equações", "Geometria", "Probabilidade", "Estatística"
   - Informática: "Hardware", "Software", "Redes", "Segurança", "Windows", "Linux", "Word", "Excel", "Internet"
   - Legislação: o artigo ou tema específico da lei mencionada
4. enunciado: Todo o texto ANTES das alternativas
5. alternativas: Objeto com A, B, C, D, E e seus textos
6. gabarito: Letra correta se indicada (ou null)
7. anulada: true se marcada como anulada

DEFINIÇÕES DE ASSUNTOS POR DISCIPLINA:

LÍNGUA PORTUGUESA:
- Interpretação de Texto: compreensão textual, inferência, vocabulário contextual, ideia principal, coesão
- Gramática/Sintaxe: período composto, orações subordinadas/coordenadas, termos da oração, regência, concordância
- Morfologia: classes de palavras (substantivo, adjetivo, verbo, advérbio), flexão, derivação, composição
- Semântica: sinônimos, antônimos, polissemia, denotação, conotação, figuras de linguagem
- Pontuação: vírgula, ponto, dois-pontos, travessão, aspas
- Ortografia: acentuação, hífen, homônimos, parônimos
- Redação Oficial: correspondência oficial, padrão culto

MATEMÁTICA E RACIOCÍNIO LÓGICO:
- Aritmética: operações básicas, frações, porcentagem, razão e proporção
- Álgebra: equações, inequações, sistemas, funções
- Geometria: áreas, volumes, ângulos, teorema de Pitágoras
- Estatística: média, mediana, moda, desvio padrão, probabilidade
- Raciocínio Lógico: proposições, conectivos, tabelas-verdade, sequências

INFORMÁTICA:
- Hardware: componentes, processador, memória, armazenamento, periféricos
- Software: sistemas operacionais, tipos de software, licenças
- Windows: interface, gerenciador de arquivos, painel de controle
- Linux: comandos básicos, estrutura de diretórios
- Microsoft Office: Word, Excel, PowerPoint (funções, formatação, fórmulas)
- Internet: navegadores, protocolos, segurança, e-mail
- Segurança: antivírus, firewall, backup, criptografia, malware

LEGISLAÇÃO/DIREITO ADMINISTRATIVO:
- Princípios da Administração: legalidade, impessoalidade, moralidade, publicidade, eficiência
- Atos Administrativos: conceito, atributos, classificação, espécies, extinção
- Poderes da Administração: vinculado, discricionário, hierárquico, disciplinar, regulamentar, de polícia
- Agentes Públicos: classificação, regime jurídico, direitos e deveres
- Licitações e Contratos: modalidades, fases, dispensa, inexigibilidade
- Serviços Públicos: conceito, princípios, formas de prestação
- Responsabilidade Civil: teoria do risco, excludentes

RETORNE JSON:
{{
  "questoes": [
    {{
      "numero": 1,
      "disciplina": "Língua Portuguesa",
      "assunto": "Interpretação de Texto",
      "enunciado": "O texto completo do enunciado...",
      "alternativas": {{
        "A": "texto alternativa A",
        "B": "texto alternativa B",
        "C": "texto alternativa C",
        "D": "texto alternativa D",
        "E": "texto alternativa E"
      }},
      "gabarito": "B",
      "anulada": false
    }}
  ]
}}

IMPORTANTE:
- Extraia TODAS as questões encontradas no texto
- Preserve o texto original do enunciado e alternativas
- Se a disciplina não for clara, use a última disciplina identificada
- SEMPRE identifique o assunto específico baseado no conteúdo da questão
- Mesmo questões anuladas devem ter assunto identificado
- Retorne APENAS JSON válido
"""

    try:
        llm = LLMOrchestrator()
        response = llm.generate(
            prompt=prompt,
            system_prompt="Você é um especialista em análise de provas de concursos públicos brasileiros. Extraia questões com precisão, preservando o texto original.",
            temperature=0.1,
            max_tokens=8192,
        )

        # Parse JSON response
        content = response["content"].strip()

        # Remove markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]

        # Find the JSON object
        start_idx = content.find("{")
        end_idx = content.rfind("}") + 1
        if start_idx != -1 and end_idx > start_idx:
            content = content[start_idx:end_idx]

        result = json.loads(content.strip())

        # Add page reference to each question
        for q in result.get("questoes", []):
            q["pagina_inicio"] = start_page
            q["status_extracao"] = "ok"
            q["alertas"] = []
            q["fonte"] = "LLM_Extraction"

            # Validate question
            if not q.get("enunciado") or len(q.get("enunciado", "")) < 10:
                q["alertas"].append("Enunciado muito curto ou vazio")
                q["status_extracao"] = "revisar_manual"

            if not q.get("alternativas") or len(q.get("alternativas", {})) < 2:
                q["alertas"].append("Alternativas incompletas")
                q["status_extracao"] = "revisar_manual"

        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        return {"metadados": {}, "questoes": []}
    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")
        return {"metadados": {}, "questoes": []}


def classify_questoes_with_taxonomia(
    questoes: list,
    taxonomia: dict
) -> list:
    """
    Classify extracted questions using the edital's taxonomia

    This is a heavier operation that maps each question to the
    specific items in the conteúdo programático.

    Args:
        questoes: List of extracted questions
        taxonomia: Taxonomia from edital

    Returns:
        list: Questions with classification added
    """
    if not taxonomia or not taxonomia.get("disciplinas"):
        logger.warning("No taxonomia provided for classification")
        return questoes

    # For now, return questions as-is
    # Full classification will be implemented as a separate endpoint
    # to allow user control over when this expensive operation runs

    logger.info(f"Classification with taxonomia: {len(questoes)} questions ready for classification")
    return questoes
