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
from src.extraction.edital_extractor import (
    DocumentType,
    extract_edital_text,
    validate_document_type,
)
from src.extraction.pdf_detector import inferir_banca_cargo_ano
from src.llm.llm_orchestrator import LLMOrchestrator


def _extract_page_text_robust(page: fitz.Page) -> str:
    """
    Extract text from a PDF page with robust handling of word-by-word layouts
    and two-column layouts.

    Some PDFs store each word as a separate text element, causing get_text()
    to break text into individual words on separate lines. This function
    reconstructs proper text by analyzing block positions.

    For two-column layouts, processes columns separately to preserve
    question order.

    Args:
        page: PyMuPDF page object

    Returns:
        Properly reconstructed text from the page
    """
    # Check for two-column layout first
    blocks = page.get_text("blocks", sort=True)
    page_width = page.rect.width
    col_boundary, _ = _detect_columns(blocks, page_width)

    # If two columns detected, always use block-based reconstruction
    if col_boundary is not None:
        return _reconstruct_text_from_blocks(page)

    # Otherwise, try the simple approach first
    simple_text = page.get_text("text", sort=True)

    # Check if text seems broken (many short lines with single words)
    lines = simple_text.strip().split("\n")
    if lines:
        # Count lines that are single words (no spaces)
        single_word_lines = sum(1 for line in lines if line.strip() and " " not in line.strip())
        total_lines = len([line for line in lines if line.strip()])

        # If more than 50% of lines are single words, text is likely broken
        if total_lines > 10 and single_word_lines / total_lines > 0.5:
            # Use block-based reconstruction
            return _reconstruct_text_from_blocks(page)

    return simple_text


def _spans_to_text(spans: list[dict]) -> str:
    """
    Convert a list of text spans to text, grouping by y-coordinate to form lines.
    """
    if not spans:
        return ""

    # Sort by y-position, then x-position
    spans.sort(key=lambda s: (s["y_center"], s["x0"]))

    # Group spans into lines based on y-coordinate proximity
    lines = []
    current_line = []
    current_y = None
    y_threshold = 5

    for span in spans:
        if current_y is None:
            current_y = span["y_center"]
            current_line = [span]
        elif abs(span["y_center"] - current_y) <= y_threshold:
            current_line.append(span)
        else:
            current_line.sort(key=lambda s: s["x0"])
            lines.append(current_line)
            current_line = [span]
            current_y = span["y_center"]

    if current_line:
        current_line.sort(key=lambda s: s["x0"])
        lines.append(current_line)

    # Build final text
    result_lines = []
    for line in lines:
        line_text = ""
        prev_x1 = None
        for span in line:
            if prev_x1 is not None:
                gap = span["x0"] - prev_x1
                if gap > 3:
                    line_text += " "
            line_text += span["text"]
            prev_x1 = span["x1"]
        result_lines.append(line_text)

    return "\n".join(result_lines)


def _detect_columns(blocks: list, page_width: float) -> tuple[float | None, float | None]:
    """
    Detect if page has two-column layout.

    Returns (left_boundary, right_boundary) if two columns detected,
    or (None, None) if single column.
    """
    # Collect x0 positions of text blocks
    x_positions = []
    for block in blocks:
        if len(block) > 4 and block[4].strip():  # Has text content
            x_positions.append(block[0])

    if len(x_positions) < 4:
        return None, None

    # Check if there are two distinct clusters of x positions
    # Typical two-column: left ~30-50, right ~280-310
    left_blocks = [x for x in x_positions if x < page_width * 0.4]
    right_blocks = [x for x in x_positions if x > page_width * 0.45]

    # Need significant content in both columns
    if len(left_blocks) >= 3 and len(right_blocks) >= 3:
        # Calculate column boundary (midpoint between columns)
        left_max = max(left_blocks) if left_blocks else 0
        right_min = min(right_blocks) if right_blocks else page_width
        boundary = (left_max + right_min) / 2
        return boundary, boundary

    return None, None


def _reconstruct_text_from_blocks(page: fitz.Page) -> str:
    """
    Reconstruct text by analyzing text blocks and their positions.
    Groups words by their y-coordinate to form proper lines.
    Handles two-column layouts by processing columns separately.
    """
    # Get blocks for column detection
    blocks = page.get_text("blocks", sort=True)
    page_width = page.rect.width

    # Detect columns
    col_boundary, _ = _detect_columns(blocks, page_width)

    # Get text as dictionary with position info
    text_dict = page.get_text("dict", sort=True)

    # Collect all text spans with their positions
    spans = []
    for block in text_dict.get("blocks", []):
        if block.get("type") == 0:  # Text block
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if text:
                        bbox = span.get("bbox", [0, 0, 0, 0])
                        spans.append(
                            {
                                "text": text,
                                "x0": bbox[0],
                                "y0": bbox[1],
                                "x1": bbox[2],
                                "y1": bbox[3],
                                "y_center": (bbox[1] + bbox[3]) / 2,
                            }
                        )

    if not spans:
        return page.get_text()

    # If two columns detected, process separately
    if col_boundary is not None:
        left_spans = [s for s in spans if s["x0"] < col_boundary]
        right_spans = [s for s in spans if s["x0"] >= col_boundary]

        left_text = _spans_to_text(left_spans)
        right_text = _spans_to_text(right_spans)

        return left_text + "\n\n" + right_text

    # Single column: sort by y-position, then x-position
    spans.sort(key=lambda s: (s["y_center"], s["x0"]))

    # Group spans into lines based on y-coordinate proximity
    # Words on the same line should have similar y_center values
    lines = []
    current_line = []
    current_y = None
    y_threshold = 5  # Pixels tolerance for same line

    for span in spans:
        if current_y is None:
            current_y = span["y_center"]
            current_line = [span]
        elif abs(span["y_center"] - current_y) <= y_threshold:
            current_line.append(span)
        else:
            # New line - sort current line by x-position and add
            current_line.sort(key=lambda s: s["x0"])
            lines.append(current_line)
            current_line = [span]
            current_y = span["y_center"]

    # Don't forget the last line
    if current_line:
        current_line.sort(key=lambda s: s["x0"])
        lines.append(current_line)

    # Build final text
    result_lines = []
    for line in lines:
        # Join words with spaces, handling gaps
        line_text = ""
        prev_x1 = None
        for span in line:
            if prev_x1 is not None:
                # Add space if there's a gap between words
                gap = span["x0"] - prev_x1
                if gap > 3:  # Small gap = space
                    line_text += " "
            line_text += span["text"]
            prev_x1 = span["x1"]
        result_lines.append(line_text)

    return "\n".join(result_lines)


# System prompt for question extraction
EXTRACTION_SYSTEM_PROMPT = """Você é um especialista em extrair questões de provas de concurso de PDFs brasileiros.

Sua tarefa é analisar o texto extraído de um PDF de prova e identificar TODAS as questões.

REGRAS IMPORTANTES:
1. Cada questão tem: número, enunciado, 5 alternativas (A-E), e gabarito (resposta correta)
2. O gabarito pode aparecer como "(Correta: X)" próximo ao número da questão ou no final
3. Identifique a DISCIPLINA de cada questão baseado nos cabeçalhos de seção (ex: "Língua Portuguesa", "Matemática", etc)
4. Se uma questão estiver marcada como ANULADA, marque anulada=true
5. Extraia o enunciado COMPLETO, incluindo textos base quando aplicável
6. NÃO invente questões - extraia apenas o que está no texto
7. Mantenha a formatação original do enunciado e alternativas
8. SEMPRE preserve os acentos e caracteres especiais do português (á, é, í, ó, ú, ã, õ, ç, etc.)

ATENÇÃO - QUESTÕES ENTRE PÁGINAS:
- Questões podem COMEÇAR em uma página e TERMINAR em outra
- Se você ver "Questão X" seguido de rodapé/número de página, o ENUNCIADO e ALTERNATIVAS estarão na página seguinte
- O texto no INÍCIO de uma página (antes de "Questão Y") geralmente pertence à questão anterior
- Sempre associe o conteúdo que aparece ANTES do próximo "Questão N" à questão anterior

FORMATO DE SAÍDA (JSON):
{
  "questoes": [
    {
      "numero": 1,
      "disciplina": "Língua Portuguesa",
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
  "disciplinas_encontradas": ["Língua Portuguesa", "Matemática", "Conhecimentos Específicos"]
}

IMPORTANTE: Retorne APENAS o JSON, sem explicações ou texto adicional."""


def extract_questions_with_llm(
    pdf_path: str | Path,
    llm: Optional[LLMOrchestrator] = None,
    max_pages: Optional[int] = None,
    skip_validation: bool = False,
) -> dict:
    """
    Extract questions from PDF using LLM.

    Args:
        pdf_path: Path to PDF file
        llm: LLM orchestrator instance (creates one if not provided)
        max_pages: Maximum pages to process (None = all)
        skip_validation: Skip document type validation (default False)

    Returns:
        dict with metadados and questoes

    Raises:
        ExtractionError: If extraction fails
        WrongDocumentTypeError: If uploaded file is not an exam with questions
    """
    try:
        pdf_path = Path(pdf_path)
        logger.info(f"Extracting questions with LLM from: {pdf_path}")

        # Validate document type - must be a prova (exam with questions)
        if not skip_validation:
            preview_text = extract_edital_text(pdf_path, max_pages=5)
            validate_document_type(preview_text, DocumentType.PROVA, "Upload de Provas")

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
            page_text = _extract_page_text_robust(page)
            # Clean up the pcimarkpci watermark
            page_text = re.sub(r"pcimarkpci\s+\S+", "", page_text)
            page_text = re.sub(r"www\.pciconcursos\.com\.br", "", page_text)
            full_text += f"\n--- PAGINA {i + 1} ---\n{page_text}"

        doc.close()

        # Infer metadata
        metadados = inferir_banca_cargo_ano(pdf_path, full_text[:2000])

        logger.info(f"Extracted {len(full_text)} chars from {pages_to_process} pages")
        logger.info("Sending to LLM for question extraction...")

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
    Parse JSON from LLM response, handling markdown code blocks and truncation.

    Args:
        response_text: Raw LLM response

    Returns:
        Parsed dict or None if parsing fails
    """
    # Step 1: Strip markdown code blocks aggressively
    cleaned = response_text.strip()

    # Remove opening markdown (```json or ```)
    if cleaned.startswith("```"):
        # Find end of first line
        first_newline = cleaned.find("\n")
        if first_newline > 0:
            cleaned = cleaned[first_newline + 1 :]

    # Remove closing markdown
    if cleaned.rstrip().endswith("```"):
        cleaned = cleaned.rstrip()[:-3].rstrip()

    # Step 2: Try direct JSON parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Step 3: Try to find the JSON object
    # Look for opening brace
    start_idx = cleaned.find("{")
    if start_idx >= 0:
        json_str = cleaned[start_idx:]
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass

        # Step 4: Try to repair truncated JSON
        # Count braces to find where JSON was truncated
        repaired = _repair_truncated_json(json_str)
        if repaired:
            try:
                return json.loads(repaired)
            except json.JSONDecodeError:
                pass

    # Step 5: Try regex extraction as fallback
    json_match = re.search(r'\{[\s\S]*"questoes"[\s\S]*\}', response_text)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    logger.error(f"Could not parse JSON from response: {response_text[:500]}...")
    return None


def _repair_truncated_json(json_str: str) -> Optional[str]:
    """
    Attempt to repair truncated JSON by closing open braces/brackets.

    Returns repaired JSON string or None if repair not possible.
    """
    # Track open braces and brackets
    open_braces = 0
    open_brackets = 0
    in_string = False
    escape_next = False
    last_valid_pos = 0

    for i, char in enumerate(json_str):
        if escape_next:
            escape_next = False
            continue

        if char == "\\" and in_string:
            escape_next = True
            continue

        if char == '"' and not escape_next:
            in_string = not in_string
            continue

        if in_string:
            continue

        if char == "{":
            open_braces += 1
        elif char == "}":
            open_braces -= 1
            if open_braces >= 0:
                last_valid_pos = i
        elif char == "[":
            open_brackets += 1
        elif char == "]":
            open_brackets -= 1
            if open_brackets >= 0:
                last_valid_pos = i

    # If we're still inside a string, try to close it
    if in_string:
        # Find the last complete question object
        # Look for pattern: "numero": N followed by complete alternatives
        last_complete = json_str.rfind('"gabarito"')
        if last_complete > 0:
            # Find the closing brace after gabarito value
            search_start = last_complete + 10
            brace_pos = json_str.find("}", search_start)
            if brace_pos > 0:
                last_valid_pos = brace_pos

    if last_valid_pos > 0:
        repaired = json_str[: last_valid_pos + 1]

        # Close remaining brackets and braces
        # Count what's still open
        open_braces = repaired.count("{") - repaired.count("}")
        open_brackets = repaired.count("[") - repaired.count("]")

        # Add closing characters
        repaired += "]" * open_brackets + "}" * open_braces

        return repaired

    return None


def _is_incomplete_question(q: dict) -> bool:
    """Check if a question has incomplete data (missing/empty alternatives)."""
    alternativas = q.get("alternativas", {})

    # No alternatives at all
    if not alternativas:
        return True

    # Count non-empty alternatives
    non_empty = sum(1 for v in alternativas.values() if v and str(v).strip())

    # Should have all 5 alternatives with content (A-E)
    if non_empty < 5:
        return True

    # Enunciado too short (likely truncated)
    enunciado = q.get("enunciado", "")
    if len(enunciado) < 20:
        return True

    return False


def _extract_orphan_content_between_questions(
    full_text: str, q_num: int, next_q_num: int
) -> Optional[str]:
    """
    Extract text that appears between two question numbers in the PDF.

    This handles cases where a question header is at the end of one page
    and its content is at the beginning of the next page.

    Args:
        full_text: Full text of the PDF with page markers
        q_num: Question number to find content for
        next_q_num: Next question number (defines the end boundary)

    Returns:
        Extracted content or None if not found
    """
    # Pattern to find "Questão N" followed by content until "Questão N+1"
    # Account for "(Correta: X)" right after question number
    pattern = rf"Quest[ãa]o\s*{q_num}\s*(?:\([^)]+\))?\s*(.*?)Quest[ãa]o\s*{next_q_num}"

    match = re.search(pattern, full_text, re.DOTALL | re.IGNORECASE)
    if match:
        content = match.group(1).strip()
        # Clean up page markers and footers
        content = re.sub(r"---\s*PAGINA\s*\d+\s*---", " ", content)
        content = re.sub(
            r"T[ée]cnico\s+Universit[áa]rio\s*-?\s*\d*", "", content, flags=re.IGNORECASE
        )
        # Remove standalone page numbers at start (e.g., "4 O conhecimento..." -> "O conhecimento...")
        content = re.sub(r"^\s*\d+\s+", "", content)
        content = re.sub(r"\s+", " ", content).strip()

        # Only return if there's meaningful content
        if len(content) > 30:
            return content

    return None


def _parse_content_to_question_parts(content: str) -> tuple[str, dict]:
    """
    Parse raw content into enunciado and alternativas.

    Args:
        content: Raw text content

    Returns:
        Tuple of (enunciado, alternativas dict)
    """
    alternativas = {}
    enunciado = content

    # Find alternatives (A) through (E) or A) through E) or A. through E.
    alt_pattern = r"\(([A-E])\)\s*([^(]*?)(?=\([A-E]\)|$)"
    alt_matches = re.findall(alt_pattern, content, re.DOTALL)

    if not alt_matches:
        # Try alternative pattern without parentheses
        alt_pattern = r"(?:^|\n)\s*([A-E])\s*[).\-]\s*([^\n]*?)(?=(?:^|\n)\s*[A-E]\s*[).\-]|$)"
        alt_matches = re.findall(alt_pattern, content, re.DOTALL | re.MULTILINE)

    if alt_matches:
        for letter, text in alt_matches:
            alternativas[letter] = text.strip()

        # Extract enunciado (everything before first alternative)
        first_alt = re.search(r"\([A-E]\)|(?:^|\n)\s*[A-E]\s*[).\-]", content)
        if first_alt:
            enunciado = content[: first_alt.start()].strip()

    return enunciado, alternativas


def _repair_incomplete_questions(
    all_questions: list[dict],
    incomplete: list[dict],
    pdf_path: Path,
    llm: "LLMOrchestrator",
) -> list[dict]:
    """
    Attempt to repair incomplete questions by:
    1. First trying direct regex extraction from PDF text (faster, more reliable)
    2. If regex fails, fall back to LLM re-extraction

    This handles cases where questions span page boundaries.
    """
    import fitz

    # Extract all text with page markers for reference
    doc = fitz.open(pdf_path)
    all_text = ""
    for i, page in enumerate(doc):
        page_text = _extract_page_text_robust(page)
        page_text = re.sub(r"pcimarkpci\s+\S+", "", page_text)
        page_text = re.sub(r"www\.pciconcursos\.com\.br", "", page_text)
        all_text += f"\n--- PAGINA {i + 1} ---\n{page_text}"
    doc.close()

    # Sort incomplete questions by number to find next question boundaries
    incomplete_sorted = sorted(incomplete, key=lambda x: x.get("numero", 0))
    all_nums = sorted([q.get("numero") for q in all_questions if q.get("numero") is not None])

    repaired_map = {}

    for q in incomplete_sorted:
        numero = q.get("numero")
        if numero is None:
            continue

        enunciado_partial = q.get("enunciado", "")[:100]
        logger.info(f"Repairing question {numero}: {enunciado_partial}...")

        # Try direct regex extraction first
        next_num = None
        for n in all_nums:
            if n > numero:
                next_num = n
                break

        if next_num:
            orphan_content = _extract_orphan_content_between_questions(all_text, numero, next_num)
            if orphan_content:
                enunciado, alternativas = _parse_content_to_question_parts(orphan_content)

                # Check if we got meaningful content
                if enunciado and len(alternativas) >= 4:
                    repaired_q = q.copy()
                    repaired_q["enunciado"] = enunciado
                    repaired_q["alternativas"] = alternativas
                    repaired_q["fonte"] = "regex_repair"
                    repaired_q["status_extracao"] = "repaired"

                    if not _is_incomplete_question(repaired_q):
                        repaired_map[numero] = repaired_q
                        logger.info(f"Successfully repaired question {numero} via regex")
                        continue
                    else:
                        logger.debug(f"Regex repair incomplete for {numero}, falling back to LLM")

        # Fall back to LLM repair
        repair_prompt = f"""Encontre e extraia a questão {numero} do texto abaixo.

ATENÇÃO: A questão pode estar DIVIDIDA entre páginas - o número "Questão {numero}" pode estar no fim de uma página,
e o enunciado/alternativas no INÍCIO da página seguinte.

Procure pelo número da questão e extraia TODO o conteúdo até a próxima questão:
- Enunciado COMPLETO (pode estar na página seguinte ao número)
- TODAS as 5 alternativas (A, B, C, D, E)
- Gabarito (resposta correta) - geralmente aparece como "(Correta: X)"
- PRESERVE todos os acentos e caracteres especiais do português (á, é, í, ó, ú, ã, õ, ç)

TEXTO DO PDF:
{all_text}

Retorne APENAS um JSON com a questão completa:
{{
  "numero": {numero},
  "disciplina": "...",
  "enunciado": "texto completo do enunciado",
  "alternativas": {{"A": "...", "B": "...", "C": "...", "D": "...", "E": "..."}},
  "gabarito": "X"
}}"""

        try:
            result = llm.generate(
                prompt=repair_prompt,
                system_prompt="Você é um especialista em extrair questões de provas. Retorne APENAS JSON válido. Preserve os acentos do português.",
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
                repaired_q = next((rq for rq in questoes if rq.get("numero") == numero), None)
            else:
                repaired_q = None

            if repaired_q and not _is_incomplete_question(repaired_q):
                repaired_q["fonte"] = "LLM_repair"
                repaired_q["status_extracao"] = "repaired"
                repaired_map[numero] = repaired_q
                logger.info(f"Successfully repaired question {numero} via LLM")
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
    pages_per_chunk: int = 5,
    overlap_pages: int = 2,
    skip_validation: bool = False,
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
        skip_validation: Skip document type validation (default False)

    Returns:
        dict with metadados and questoes

    Raises:
        WrongDocumentTypeError: If uploaded file is not an exam with questions
    """
    try:
        pdf_path = Path(pdf_path)
        logger.info(f"Extracting questions in chunks from: {pdf_path}")

        # Validate document type - must be a prova (exam with questions)
        if not skip_validation:
            preview_text = extract_edital_text(pdf_path, max_pages=5)
            validate_document_type(preview_text, DocumentType.PROVA, "Upload de Provas")

        if llm is None:
            llm = LLMOrchestrator()

        doc = fitz.open(pdf_path)
        total_pages = len(doc)

        # Infer metadata from first pages
        first_text = ""
        for i in range(min(3, total_pages)):
            first_text += _extract_page_text_robust(doc[i])
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
            logger.info(
                f"Processing pages {start_page + 1}-{end_page}/{total_pages} (overlap={overlap_pages})"
            )

            # Extract chunk
            doc = fitz.open(pdf_path)
            chunk_text = ""
            for i in range(start_page, end_page):
                page_text = _extract_page_text_robust(doc[i])
                page_text = re.sub(r"pcimarkpci\s+\S+", "", page_text)
                page_text = re.sub(r"www\.pciconcursos\.com\.br", "", page_text)
                chunk_text += f"\n--- PAGINA {i + 1} ---\n{page_text}"
            doc.close()

            # Skip mostly empty chunks
            if len(chunk_text.strip()) < 500:
                logger.debug(f"Skipping near-empty chunk (pages {start_page + 1}-{end_page})")
                start_page += stride  # Must advance even when skipping!
                continue

            # Call LLM for this chunk
            user_prompt = f"""Analise o texto abaixo (paginas {start_page + 1}-{end_page} de uma prova) e extraia as questoes.

TEXTO:
{chunk_text}

Extraia todas as questoes encontradas no formato JSON."""

            result = llm.generate(
                prompt=user_prompt,
                system_prompt=EXTRACTION_SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=8192,  # Groq Llama 4 Scout max output limit
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

        logger.info(
            f"Total extracted: {len(unique_questoes)} unique questions (from {len(all_questoes)} with overlap)"
        )

        # Detect and retry incomplete questions (empty alternatives)
        incomplete_questions = [q for q in unique_questoes if _is_incomplete_question(q)]

        if incomplete_questions:
            logger.warning(
                f"Found {len(incomplete_questions)} incomplete questions, attempting repair..."
            )
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
