"""
Map Service - Phase 2 of the Deep Analysis Pipeline
Processes chunks of questions using Llama 4 Scout via Groq
"""
from dataclasses import dataclass
from typing import Optional
import json
from loguru import logger

from src.llm.llm_orchestrator import LLMOrchestrator


@dataclass
class QuestionAnalysis:
    """Analysis result for a single question"""
    questao_id: str
    difficulty: str  # 'easy', 'medium', 'hard', 'very_hard'
    difficulty_reasoning: str
    bloom_level: str  # 'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'
    has_trap: bool
    trap_description: Optional[str] = None


@dataclass
class ChunkDigest:
    """Digest result for a chunk of questions"""
    chunk_id: str
    summary: str  # 2-3 sentence summary of patterns in this chunk
    patterns_found: list[dict]  # {type, description, evidence_ids, confidence}
    questions_analysis: list[QuestionAnalysis]


class MapService:
    """
    Map Service for Phase 2 of the deep analysis pipeline

    Processes chunks of 15-25 questions using the "CoT then Formatting" technique:
    1. LLM reasons freely in <thinking> tags
    2. Then produces structured JSON output
    """

    CHUNK_SIZE = 20  # Default chunk size (15-25 questions)

    def __init__(self, llm: Optional[LLMOrchestrator] = None):
        self.llm = llm or LLMOrchestrator()

    def create_chunks(
        self,
        questoes: list[dict],
        chunk_size: int = CHUNK_SIZE
    ) -> list[list[dict]]:
        """
        Split questions into chunks for parallel processing

        Args:
            questoes: List of question dicts
            chunk_size: Target chunk size (default 20)

        Returns:
            List of chunks, each containing chunk_size questions
        """
        chunks = []
        for i in range(0, len(questoes), chunk_size):
            chunks.append(questoes[i:i + chunk_size])
        logger.info(f"Created {len(chunks)} chunks from {len(questoes)} questions")
        return chunks

    def analyze_chunk(
        self,
        chunk_id: str,
        questoes: list[dict],
        disciplina: str,
        banca: str,
        cluster_info: Optional[dict] = None,
    ) -> ChunkDigest:
        """
        Analyze a single chunk of questions using LLM

        Args:
            chunk_id: Identifier for this chunk
            questoes: List of question dicts in this chunk
            disciplina: Discipline name
            banca: Exam board name
            cluster_info: Optional cluster IDs from Phase 1

        Returns:
            ChunkDigest with patterns and question analyses
        """
        logger.info(f"Analyzing chunk {chunk_id}: {len(questoes)} questions")

        # Format questions for prompt
        questoes_json = json.dumps(questoes, ensure_ascii=False, indent=2)

        # Build the analysis prompt using "CoT then Formatting"
        prompt = self._build_analysis_prompt(
            disciplina=disciplina,
            banca=banca,
            questoes_json=questoes_json,
            cluster_info=cluster_info
        )

        try:
            # Call LLM with the analysis prompt
            response = self.llm.generate(
                prompt,
                temperature=0.3,
                max_tokens=8000,
                preferred_provider="groq"
            )

            # Extract text content from response dict
            response_text = response.get("text", "") if isinstance(response, dict) else str(response)

            # Parse the response
            return self._parse_response(chunk_id, response_text, questoes)

        except Exception as e:
            logger.error(f"Failed to analyze chunk {chunk_id}: {e}")
            # Return empty digest on error
            return ChunkDigest(
                chunk_id=chunk_id,
                summary=f"Erro na analise: {str(e)[:100]}",
                patterns_found=[],
                questions_analysis=[]
            )

    def _build_analysis_prompt(
        self,
        disciplina: str,
        banca: str,
        questoes_json: str,
        cluster_info: Optional[dict] = None,
    ) -> str:
        """Build the analysis prompt with CoT instructions"""

        cluster_context = ""
        if cluster_info:
            cluster_context = f"""
Dados vetoriais indicam clusters de similaridade nas questoes: {json.dumps(cluster_info, ensure_ascii=False)}
"""

        return f"""<system>
Voce e um analista especializado em questoes de concursos publicos brasileiros.
Sua tarefa e identificar TODOS os padroes nos dados, mesmo sutis.
CRITICO: Nao omita padroes por parecerem obvios. Prefira falsos positivos
a falsos negativos. Quantifique TUDO: frequencias, percentuais, contagens.
</system>

<context>
Disciplina: {disciplina}
Banca: {banca}
{cluster_context}
</context>

<data format="json">
{questoes_json}
</data>

<instructions>
NAO gere JSON imediatamente. Primeiro, dentro de <thinking>:

1. Identifique a "assinatura" da banca:
   - Cebraspe: Item errado anula certo? Interpretacao ambigua?
   - FGV: Exige conhecimento enciclopedico externo?
   - FCC: Foco em gramatica normativa literal?

2. Para questoes do cluster de similaridade:
   - A repeticao e exata ou conceitual?
   - Houve evolucao de dificuldade entre elas?

3. Para cada questao, classifique dificuldade via simulacao:
   - Estudante A (Iniciante): Acertaria?
   - Estudante B (Intermediario): Acertaria?
   - Estudante C (Avancado): Acertaria?

4. Identifique "pegadinhas":
   - Palavras: 'exceto', 'prescinde', 'nao e incorreto'
   - Negacoes duplas
   - Alternativas "pegadinha" que parecem certas

INSTRUCOES ANTI-OMISSAO:
- Analise questoes das posicoes CENTRAIS com a MESMA atencao que as primeiras
- Liste padroes de BAIXA confianca em secao separada (nao omita)
- Identifique tambem AUSENCIAS de padrao esperado

Apos analise, gere JSON conforme schema.
</thinking>

<output_schema>
{{
  "chunk_digest": "string - resumo de 2-3 frases dos padroes deste lote",
  "patterns_found": [{{
    "type": "temporal|similaridade|dificuldade|estilo|pegadinha",
    "description": "string",
    "evidence_ids": ["Q001", "Q015"],
    "confidence": "high|medium|low"
  }}],
  "questions_analysis": [{{
    "id": "string",
    "difficulty": "easy|medium|hard|very_hard",
    "difficulty_reasoning": "string - baseado na simulacao IRT",
    "bloom_level": "remember|understand|apply|analyze|evaluate|create",
    "has_trap": true|false,
    "trap_description": "string ou null"
  }}]
}}
</output_schema>"""

    def _parse_response(
        self,
        chunk_id: str,
        response: str,
        questoes: list[dict]
    ) -> ChunkDigest:
        """Parse LLM response into ChunkDigest"""
        try:
            # Extract JSON from response (may be wrapped in markdown code blocks)
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0].strip()

            data = json.loads(json_str)

            # Build QuestionAnalysis objects
            analyses = []
            for qa in data.get("questions_analysis", []):
                analyses.append(QuestionAnalysis(
                    questao_id=qa.get("id", ""),
                    difficulty=qa.get("difficulty", "medium"),
                    difficulty_reasoning=qa.get("difficulty_reasoning", ""),
                    bloom_level=qa.get("bloom_level", "understand"),
                    has_trap=qa.get("has_trap", False),
                    trap_description=qa.get("trap_description")
                ))

            return ChunkDigest(
                chunk_id=chunk_id,
                summary=data.get("chunk_digest", ""),
                patterns_found=data.get("patterns_found", []),
                questions_analysis=analyses
            )

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON response for chunk {chunk_id}: {e}")
            return ChunkDigest(
                chunk_id=chunk_id,
                summary="Erro ao parsear resposta JSON",
                patterns_found=[],
                questions_analysis=[]
            )
