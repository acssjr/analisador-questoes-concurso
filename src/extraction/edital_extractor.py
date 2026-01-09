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
            "cargo": str,
            "ano": int,
            "disciplinas": list[str]
        }
    """
    try:
        # Extract text
        text = extract_edital_text(pdf_path, max_pages=10)

        # Build LLM prompt
        prompt = f"""Analise este edital de concurso público e extraia as seguintes informações:

TEXTO DO EDITAL (primeiras páginas):
{text[:8000]}

TAREFA:
Extraia as seguintes informações em formato JSON:
- nome: Nome completo do concurso (ex: "TRF 5ª Região 2024 - Analista Judiciário")
- banca: Banca organizadora (ex: "CESPE/CEBRASPE", "FCC", "FGV")
- cargo: Cargo específico (ex: "Analista Judiciário - Tecnologia da Informação")
- ano: Ano do concurso (número inteiro)
- disciplinas: Lista de disciplinas cobradas (ex: ["Língua Portuguesa", "Raciocínio Lógico", "Direito Constitucional"])

IMPORTANTE:
- Seja preciso e extraia exatamente o que está escrito
- Se não encontrar uma informação, use null
- Retorne APENAS o JSON, sem explicações

Exemplo de resposta:
{{
  "nome": "Concurso Público TRF 5ª Região 2024",
  "banca": "CESPE/CEBRASPE",
  "cargo": "Analista Judiciário - Área: Tecnologia da Informação",
  "ano": 2024,
  "disciplinas": ["Língua Portuguesa", "Raciocínio Lógico", "Direito Constitucional", "Direito Administrativo", "Tecnologia da Informação"]
}}
"""

        llm = LLMOrchestrator()
        response = llm.generate(
            prompt=prompt,
            system_prompt="Você é um especialista em análise de editais de concursos públicos brasileiros.",
            temperature=0.1,
            max_tokens=1024,
        )

        # Parse JSON response
        content = response["content"].strip()

        # Remove markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]

        metadata = json.loads(content.strip())

        logger.info(f"Extracted edital metadata: {metadata.get('nome')}")

        return metadata

    except Exception as e:
        logger.error(f"Failed to extract edital metadata: {e}")
        raise ExtractionError(f"Edital metadata extraction failed: {e}")


def extract_conteudo_programatico(pdf_path: str | Path) -> dict:
    """
    Extract hierarchical taxonomy from conteúdo programático PDF

    Args:
        pdf_path: Path to conteúdo programático PDF

    Returns:
        dict: Taxonomia hierárquica
        {
            "disciplinas": [
                {
                    "nome": "Língua Portuguesa",
                    "assuntos": [
                        {
                            "nome": "Sintaxe",
                            "topicos": [
                                {
                                    "nome": "Período Composto",
                                    "subtopicos": ["Orações Subordinadas", ...]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    """
    try:
        # Extract full text (conteúdo programático can be long)
        text = extract_edital_text(pdf_path, max_pages=30)

        # Build LLM prompt for taxonomy extraction
        prompt = f"""Analise este conteúdo programático de concurso público e extraia a taxonomia hierárquica COMPLETA.

TEXTO DO CONTEÚDO PROGRAMÁTICO:
{text[:12000]}

TAREFA:
Extraia a estrutura hierárquica completa de todas as disciplinas e seus conteúdos:

DISCIPLINA → ASSUNTO → TÓPICO → SUBTÓPICO → CONCEITO

Estrutura do JSON:
{{
  "disciplinas": [
    {{
      "nome": "Nome da Disciplina",
      "assuntos": [
        {{
          "nome": "Nome do Assunto",
          "topicos": [
            {{
              "nome": "Nome do Tópico",
              "subtopicos": ["Subtópico 1", "Subtópico 2", ...]
            }}
          ]
        }}
      ]
    }}
  ]
}}

IMPORTANTE:
- Preserve a hierarquia EXATA do documento
- Inclua TODOS os itens, mesmo os mais detalhados
- Use os nomes EXATOS como aparecem no edital
- Organize em níveis hierárquicos claros
- Retorne APENAS o JSON, sem explicações

Exemplo:
{{
  "disciplinas": [
    {{
      "nome": "Língua Portuguesa",
      "assuntos": [
        {{
          "nome": "Sintaxe",
          "topicos": [
            {{
              "nome": "Período Composto",
              "subtopicos": [
                "Orações Subordinadas Substantivas",
                "Orações Subordinadas Adjetivas",
                "Orações Subordinadas Adverbiais"
              ]
            }},
            {{
              "nome": "Concordância",
              "subtopicos": ["Concordância Nominal", "Concordância Verbal"]
            }}
          ]
        }}
      ]
    }}
  ]
}}
"""

        llm = LLMOrchestrator()
        response = llm.generate(
            prompt=prompt,
            system_prompt="Você é um especialista em análise de editais de concursos públicos brasileiros. Sua especialidade é extrair taxonomias hierárquicas precisas.",
            temperature=0.1,
            max_tokens=4096,
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
        logger.info(f"Extracted taxonomia with {total_disciplinas} disciplinas")

        return taxonomia

    except Exception as e:
        logger.error(f"Failed to extract conteúdo programático: {e}")
        raise ExtractionError(f"Conteúdo programático extraction failed: {e}")
