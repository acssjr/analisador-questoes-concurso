"""
Edital extraction logic - extracts metadata and taxonomy from exam notices
"""

import json
import re
from enum import Enum
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from loguru import logger

from src.core.exceptions import ExtractionError
from src.llm.llm_orchestrator import LLMOrchestrator


def _sanitize_json_string(json_str: str) -> str:
    """
    Sanitize JSON string by removing/escaping invalid control characters.

    LLMs sometimes return JSON with invalid control characters (newlines, tabs)
    inside string values, which causes json.loads() to fail.
    """
    # Remove any BOM or other unicode artifacts
    json_str = json_str.strip()

    # Common control characters that break JSON parsing inside strings
    # We need to be careful to only fix characters INSIDE strings, not structural ones

    # First, try parsing as-is
    try:
        json.loads(json_str)
        return json_str
    except json.JSONDecodeError:
        pass

    # Replace common problematic patterns
    # Tab inside strings -> escaped tab
    # Literal newlines inside strings -> escaped newline
    # This is a simplified approach that works for most LLM outputs

    result = []
    in_string = False
    escape_next = False

    for char in json_str:
        if escape_next:
            result.append(char)
            escape_next = False
            continue

        if char == '\\':
            result.append(char)
            escape_next = True
            continue

        if char == '"':
            result.append(char)
            in_string = not in_string
            continue

        if in_string:
            # Replace problematic characters inside strings
            if char == '\n':
                result.append('\\n')
            elif char == '\r':
                result.append('\\r')
            elif char == '\t':
                result.append('\\t')
            elif ord(char) < 32:
                # Other control characters - skip them
                pass
            else:
                result.append(char)
        else:
            result.append(char)

    return ''.join(result)


class DocumentType(Enum):
    """Types of documents that can be uploaded"""

    EDITAL = "edital"
    CONTEUDO_PROGRAMATICO = "conteudo_programatico"
    PROVA = "prova"
    DESCONHECIDO = "desconhecido"


class WrongDocumentTypeError(ExtractionError):
    """Raised when user uploads the wrong type of document"""

    def __init__(self, expected: DocumentType, detected: DocumentType, message: str):
        self.expected = expected
        self.detected = detected
        super().__init__(message)


def detect_document_type(text: str) -> tuple[DocumentType, float, str]:
    """
    Detect the type of document based on its content using LLM.

    Args:
        text: Extracted text from the PDF (first few pages)

    Returns:
        tuple: (DocumentType, confidence 0-1, explanation)
    """
    prompt = f"""Analise o texto abaixo e classifique o tipo de documento.

TEXTO (primeiras páginas):
{text[:8000]}

TIPOS POSSÍVEIS:
1. EDITAL - Documento oficial do concurso com: requisitos, datas, inscrições, regras gerais, informações do órgão
2. CONTEUDO_PROGRAMATICO - Lista de tópicos/matérias a serem estudadas, organizada por disciplinas (ex: "1. Língua Portuguesa: 1.1 Interpretação de texto...")
3. PROVA - Documento com questões de múltipla escolha, enunciados, alternativas (A, B, C, D, E), gabaritos

SINAIS DE CADA TIPO:
- EDITAL: "Das inscrições", "Do cargo", "Das vagas", "cronograma", "edital nº", valores de inscrição
- CONTEUDO_PROGRAMATICO: listas numeradas de tópicos, "Conhecimentos Básicos", "Conhecimentos Específicos", disciplinas como "Língua Portuguesa", "Direito Constitucional"
- PROVA: "Questão 01", "Questão 02", alternativas "(A)", "(B)", "(C)", "(D)", "(E)", "Marque a alternativa", enunciados longos seguidos de opções

ATENÇÃO:
- Se o documento tiver QUESTÕES com ALTERNATIVAS, é uma PROVA (mesmo que mencione disciplinas)
- Se tiver lista de TÓPICOS sem questões, é CONTEUDO_PROGRAMATICO
- Se tiver informações administrativas do concurso, é EDITAL

Responda em JSON:
{{
  "tipo": "EDITAL" | "CONTEUDO_PROGRAMATICO" | "PROVA" | "DESCONHECIDO",
  "confianca": 0.0 a 1.0,
  "explicacao": "breve explicação do porquê desta classificação",
  "sinais_detectados": ["sinal1", "sinal2", ...]
}}
"""

    try:
        llm = LLMOrchestrator()
        response = llm.generate(
            prompt=prompt,
            system_prompt="Você é um classificador de documentos de concursos públicos. Seja preciso e analítico.",
            temperature=0.1,
            max_tokens=512,
        )

        content = response["content"].strip()

        # Remove markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]

        result = json.loads(content.strip())

        tipo_str = result.get("tipo", "DESCONHECIDO").upper()
        tipo_map = {
            "EDITAL": DocumentType.EDITAL,
            "CONTEUDO_PROGRAMATICO": DocumentType.CONTEUDO_PROGRAMATICO,
            "PROVA": DocumentType.PROVA,
            "DESCONHECIDO": DocumentType.DESCONHECIDO,
        }

        doc_type = tipo_map.get(tipo_str, DocumentType.DESCONHECIDO)
        confidence = float(result.get("confianca", 0.5))
        explanation = result.get("explicacao", "")

        logger.info(f"Document type detected: {doc_type.value} (confidence: {confidence:.2f})")

        return doc_type, confidence, explanation

    except Exception as e:
        logger.warning(f"Document type detection failed: {e}")
        return DocumentType.DESCONHECIDO, 0.0, str(e)


def validate_document_type(text: str, expected: DocumentType, step_name: str) -> None:
    """
    Validate that the uploaded document matches the expected type.

    Args:
        text: Extracted text from PDF
        expected: Expected document type for this upload step
        step_name: Human-readable name of the upload step (for error messages)

    Raises:
        WrongDocumentTypeError: If document type doesn't match expected
    """
    detected, confidence, explanation = detect_document_type(text)

    # If we can't detect with confidence, let it through
    if detected == DocumentType.DESCONHECIDO or confidence < 0.6:
        logger.warning(f"Could not confidently detect document type (confidence: {confidence:.2f})")
        return

    # Check if detected type matches expected
    if detected != expected:
        type_names = {
            DocumentType.EDITAL: "um edital",
            DocumentType.CONTEUDO_PROGRAMATICO: "um conteúdo programático",
            DocumentType.PROVA: "uma prova com questões",
            DocumentType.DESCONHECIDO: "um documento desconhecido",
        }

        expected_name = type_names.get(expected, str(expected))
        detected_name = type_names.get(detected, str(detected))

        error_msg = (
            f"Tipo de documento incorreto para '{step_name}'. "
            f"Esperado: {expected_name}. "
            f"Detectado: {detected_name} (confiança: {confidence:.0%}). "
            f"Motivo: {explanation}"
        )

        logger.error(error_msg)
        raise WrongDocumentTypeError(expected, detected, error_msg)


def extract_edital_text(pdf_path: str | Path, max_pages: int = 10) -> str:
    """
    Extract text from edital PDF (first N pages)

    Args:
        pdf_path: Path to PDF file
        max_pages: Maximum pages to extract (editais can be long)

    Returns:
        str: Extracted text
    """
    try:
        doc = fitz.open(pdf_path)
        text = ""

        # Extract first max_pages
        for page_num in range(min(max_pages, len(doc))):
            text += doc[page_num].get_text()

        doc.close()
        logger.debug(f"Extracted {len(text)} chars from edital PDF")

        return text

    except Exception as e:
        logger.error(f"Failed to extract edital text: {e}")
        raise ExtractionError(f"Edital text extraction failed: {e}")


def extract_edital_metadata(pdf_path: str | Path, skip_validation: bool = False) -> dict:
    """
    Extract metadata from edital using LLM

    Args:
        pdf_path: Path to edital PDF
        skip_validation: Skip document type validation (default False)

    Returns:
        dict: {
            "nome": str,
            "banca": str,
            "cargos": list[str],  # Lista de todos os cargos do edital
            "ano": int,
            "disciplinas": list[str]
        }

    Raises:
        WrongDocumentTypeError: If uploaded file is not an edital
    """
    try:
        # Extract text
        text = extract_edital_text(pdf_path, max_pages=15)

        # Validate document type
        if not skip_validation:
            validate_document_type(text, DocumentType.EDITAL, "Upload do Edital")

        # Build LLM prompt
        prompt = f"""Analise este edital de concurso público e extraia as seguintes informações:

TEXTO DO EDITAL (primeiras páginas):
{text[:10000]}

TAREFA:
Extraia as seguintes informações em formato JSON:
- nome: Nome completo do concurso (ex: "TRF 5ª Região 2024")
- banca: Banca organizadora (ex: "CESPE/CEBRASPE", "FCC", "FGV")
- cargos: Lista de TODOS os cargos disponíveis no edital (ex: ["Analista Judiciário - TI", "Analista Judiciário - Contabilidade", "Técnico Judiciário"])
- ano: Ano do concurso (número inteiro)
- disciplinas: Lista de disciplinas comuns cobradas (ex: ["Língua Portuguesa", "Raciocínio Lógico"])

IMPORTANTE:
- Extraia TODOS os cargos mencionados no edital, não apenas um
- Se houver apenas um cargo, retorne uma lista com um item
- Seja preciso e extraia exatamente o que está escrito
- Se não encontrar uma informação, use null
- Retorne APENAS o JSON, sem explicações

Exemplo de resposta:
{{
  "nome": "Concurso Público TRF 5ª Região 2024",
  "banca": "CESPE/CEBRASPE",
  "cargos": [
    "Analista Judiciário - Área: Tecnologia da Informação",
    "Analista Judiciário - Área: Contabilidade",
    "Analista Judiciário - Área: Administrativa",
    "Técnico Judiciário - Área: Administrativa"
  ],
  "ano": 2024,
  "disciplinas": ["Língua Portuguesa", "Raciocínio Lógico", "Direito Constitucional", "Direito Administrativo"]
}}
"""

        llm = LLMOrchestrator()
        response = llm.generate(
            prompt=prompt,
            system_prompt="Você é um especialista em análise de editais de concursos públicos brasileiros.",
            temperature=0.1,
            max_tokens=2048,
        )

        # Parse JSON response
        content = response["content"].strip()

        # Remove markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]

        metadata = json.loads(content.strip())

        # Ensure cargos is always a list
        if "cargo" in metadata and "cargos" not in metadata:
            # Legacy format - convert single cargo to list
            cargo_str = metadata["cargo"] or ""
            # Try to split combined cargo strings like "Analista e Técnico"
            if " e " in cargo_str:
                # Split by " e " and clean up each part
                parts = [p.strip() for p in cargo_str.split(" e ")]
                metadata["cargos"] = parts
            else:
                metadata["cargos"] = [cargo_str] if cargo_str else []

        if not metadata.get("cargos"):
            metadata["cargos"] = []

        logger.info(
            f"Extracted edital metadata: {metadata.get('nome')} with {len(metadata.get('cargos', []))} cargos: {metadata.get('cargos')}"
        )

        return metadata

    except Exception as e:
        logger.error(f"Failed to extract edital metadata: {e}")
        raise ExtractionError(f"Edital metadata extraction failed: {e}")


def extract_conteudo_programatico(
    pdf_path: str | Path, cargo: Optional[str] = None, skip_validation: bool = False
) -> dict:
    """
    Extract hierarchical taxonomy from conteúdo programático PDF

    Uses adaptive recursive structure that preserves the exact hierarchy from the edital,
    supporting 1 to N levels of depth as needed.

    Args:
        pdf_path: Path to conteúdo programático PDF
        cargo: Optional cargo name to filter content for specific cargo
        skip_validation: Skip document type validation (default False)

    Returns:
        dict: Taxonomia hierárquica adaptativa
        {
            "disciplinas": [
                {
                    "nome": "Língua Portuguesa",
                    "itens": [
                        {
                            "id": "1",
                            "texto": "Compreensão e interpretação de texto",
                            "filhos": []
                        },
                        {
                            "id": "8",
                            "texto": "Estatística",
                            "filhos": [
                                {"id": "8.1", "texto": "Medidas de tendência central", "filhos": []},
                                {"id": "8.2", "texto": "Medidas de dispersão", "filhos": []}
                            ]
                        }
                    ]
                }
            ]
        }

    Raises:
        WrongDocumentTypeError: If uploaded file contains exam questions instead of syllabus
    """
    try:
        # Extract full text (conteúdo programático can be long)
        text = extract_edital_text(pdf_path, max_pages=50)

        # Validate document type - reject if it's a prova (exam with questions)
        if not skip_validation:
            validate_document_type(
                text, DocumentType.CONTEUDO_PROGRAMATICO, "Upload do Conteúdo Programático"
            )

        # Build cargo-specific instruction
        cargo_instruction = ""
        if cargo:
            cargo_instruction = f"""
ATENÇÃO - CARGO ESPECÍFICO:
Extraia APENAS o conteúdo programático do cargo: "{cargo}"
Ignore disciplinas e conteúdos de outros cargos.
Se o documento tiver seções por cargo, foque apenas na seção deste cargo.
"""

        # Build LLM prompt for taxonomy extraction - use more text for complete extraction
        # Use up to 25000 chars to capture full content
        text_to_analyze = text[:25000]

        prompt = f"""Analise este conteúdo programático de concurso público e extraia a estrutura hierárquica EXATA como aparece no documento.

TEXTO DO CONTEÚDO PROGRAMÁTICO:
{text_to_analyze}
{cargo_instruction}
TAREFA CRÍTICA:
Extraia a estrutura hierárquica EXATA preservando a numeração original do edital.
A estrutura é RECURSIVA e ADAPTATIVA - pode ter 1, 2, 3 ou mais níveis conforme o edital.

REGRAS ABSOLUTAS:
1. PRESERVE a numeração EXATA do edital (ex: "1", "1.2", "2.1.3")
2. Se um item NÃO tem número, use id: null
3. Item X.Y é SEMPRE filho de X (ex: 8.1 é filho de 8)
4. Item X.Y.Z é SEMPRE filho de X.Y (ex: 2.1.1 é filho de 2.1)
5. NÃO INVENTE números que não existem no edital
6. NÃO "CORRIJA" erros de numeração do edital - preserve como está
7. Itens sem sub-itens têm filhos: []
8. Use o TEXTO EXATO como aparece no edital

ESTRUTURA RECURSIVA DO JSON:
{{
  "disciplinas": [
    {{
      "nome": "Nome da Disciplina (ex: MATEMÁTICA E RACIOCÍNIO LÓGICO)",
      "itens": [
        {{
          "id": "1",
          "texto": "Texto do item 1",
          "filhos": []
        }},
        {{
          "id": "8",
          "texto": "Estatística",
          "filhos": [
            {{"id": "8.1", "texto": "Medidas de tendência central (média, mediana e moda)", "filhos": []}},
            {{"id": "8.2", "texto": "Medidas de dispersão (variância, desvio-padrão, amplitude)", "filhos": []}}
          ]
        }},
        {{
          "id": "2",
          "texto": "Noções de Direito Administrativo",
          "filhos": [
            {{
              "id": "2.1",
              "texto": "Poderes Administrativos",
              "filhos": [
                {{"id": "2.1.1", "texto": "Vinculado", "filhos": []}},
                {{"id": "2.1.2", "texto": "Discricionário", "filhos": []}},
                {{"id": "2.1.3", "texto": "Hierárquico", "filhos": []}}
              ]
            }}
          ]
        }}
      ]
    }}
  ]
}}

EXEMPLO - Como interpretar texto corrido:
Texto: "8. Estatística: 8.1 Medidas de tendência central; 8.2 Medidas de dispersão"
Resultado: item 8 com dois filhos (8.1 e 8.2)

EXEMPLO - Item sem número:
Texto: "Conceitos e princípios básicos da Administração Pública"
Resultado: {{"id": null, "texto": "Conceitos e princípios básicos da Administração Pública", "filhos": []}}

IMPORTANTE: Retorne APENAS o JSON. Extraia TODOS os itens do documento com a hierarquia correta.
"""

        llm = LLMOrchestrator()
        response = llm.generate(
            prompt=prompt,
            system_prompt="Você é um especialista em análise de editais de concursos públicos brasileiros. Sua tarefa é extrair taxonomias hierárquicas COMPLETAS E DETALHADAS, preservando CADA lei, artigo e item mencionado no edital. NUNCA resuma ou agrupe itens.",
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

        # Sanitize JSON - remove invalid control characters
        content = _sanitize_json_string(content.strip())

        taxonomia = json.loads(content)

        total_disciplinas = len(taxonomia.get("disciplinas", []))
        cargo_info = f" for cargo '{cargo}'" if cargo else ""
        logger.info(f"Extracted taxonomia with {total_disciplinas} disciplinas{cargo_info}")

        return taxonomia

    except Exception as e:
        logger.error(f"Failed to extract conteúdo programático: {e}")
        raise ExtractionError(f"Conteúdo programático extraction failed: {e}")
