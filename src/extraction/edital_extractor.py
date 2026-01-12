"""
Edital extraction logic - extracts metadata and taxonomy from exam notices
"""
import json
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from loguru import logger

from src.core.exceptions import ExtractionError
from src.llm.llm_orchestrator import LLMOrchestrator


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


def extract_edital_metadata(pdf_path: str | Path) -> dict:
    """
    Extract metadata from edital using LLM

    Args:
        pdf_path: Path to edital PDF

    Returns:
        dict: {
            "nome": str,
            "banca": str,
            "cargos": list[str],  # Lista de todos os cargos do edital
            "ano": int,
            "disciplinas": list[str]
        }
    """
    try:
        # Extract text
        text = extract_edital_text(pdf_path, max_pages=15)

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

        logger.info(f"Extracted edital metadata: {metadata.get('nome')} with {len(metadata.get('cargos', []))} cargos: {metadata.get('cargos')}")

        return metadata

    except Exception as e:
        logger.error(f"Failed to extract edital metadata: {e}")
        raise ExtractionError(f"Edital metadata extraction failed: {e}")


def extract_conteudo_programatico(pdf_path: str | Path, cargo: Optional[str] = None) -> dict:
    """
    Extract hierarchical taxonomy from conteúdo programático PDF

    Uses adaptive recursive structure that preserves the exact hierarchy from the edital,
    supporting 1 to N levels of depth as needed.

    Args:
        pdf_path: Path to conteúdo programático PDF
        cargo: Optional cargo name to filter content for specific cargo

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
    """
    try:
        # Extract full text (conteúdo programático can be long)
        text = extract_edital_text(pdf_path, max_pages=50)

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

        taxonomia = json.loads(content.strip())

        total_disciplinas = len(taxonomia.get("disciplinas", []))
        cargo_info = f" for cargo '{cargo}'" if cargo else ""
        logger.info(f"Extracted taxonomia with {total_disciplinas} disciplinas{cargo_info}")

        return taxonomia

    except Exception as e:
        logger.error(f"Failed to extract conteúdo programático: {e}")
        raise ExtractionError(f"Conteúdo programático extraction failed: {e}")
