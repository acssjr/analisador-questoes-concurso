"""
Reduce Service - Phase 3 of the Deep Analysis Pipeline
Synthesizes patterns from chunk digests using Claude Multi-Pass
"""
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional
import json

from loguru import logger

from src.llm.llm_orchestrator import LLMOrchestrator
from src.analysis.map_service import ChunkDigest, QuestionAnalysis


@dataclass
class PatternFinding:
    """A pattern found across multiple passes"""
    pattern_type: str  # 'temporal', 'similaridade', 'dificuldade', 'estilo', 'pegadinha'
    description: str
    evidence_ids: list[str]
    confidence: str  # 'high', 'medium', 'low'
    votes: int  # How many passes found this pattern (for majority voting)


@dataclass
class AnalysisReport:
    """Final synthesized analysis report"""
    disciplina: str
    total_questoes: int
    temporal_patterns: list[PatternFinding]
    similarity_patterns: list[PatternFinding]
    difficulty_analysis: dict  # Summary of difficulty distribution
    trap_analysis: dict  # Summary of common traps
    study_recommendations: list[str]  # Actionable insights
    raw_text: str  # Full text report from LLM


class ReduceService:
    """
    Reduce Service for Phase 3 of the deep analysis pipeline

    Uses Multi-Pass technique:
    - 5-7 passes with temperature > 0
    - Each pass searches for patterns
    - Majority voting consolidates findings
    """

    DEFAULT_NUM_PASSES = 5
    VOTING_THRESHOLD_HIGH = 3  # >=3/5 = high confidence
    VOTING_THRESHOLD_MEDIUM = 2  # 2/5 = medium confidence

    def __init__(
        self,
        llm: Optional[LLMOrchestrator] = None,
        num_passes: int = DEFAULT_NUM_PASSES,
        temperature: float = 0.7
    ):
        self.llm = llm or LLMOrchestrator()
        self.num_passes = num_passes
        self.temperature = temperature

    def synthesize(
        self,
        chunk_digests: list[ChunkDigest],
        similarity_report: dict,
        disciplina: str,
        banca: str,
        anos: list[int],
        total_questoes: int
    ) -> AnalysisReport:
        """
        Synthesize analysis from chunk digests using Multi-Pass

        Args:
            chunk_digests: List of ChunkDigest from Map phase
            similarity_report: Similarity findings from Phase 1
            disciplina: Discipline name
            banca: Exam board name
            anos: List of years covered
            total_questoes: Total number of questions analyzed

        Returns:
            AnalysisReport with synthesized findings
        """
        logger.info(f"Starting Multi-Pass synthesis: {self.num_passes} passes for {disciplina}")

        # Prepare input for synthesis
        digests_summary = self._format_digests(chunk_digests)

        # Run multiple passes
        all_patterns: list[dict] = []
        all_reports: list[str] = []
        all_recommendations: list[str] = []

        for pass_num in range(self.num_passes):
            logger.info(f"Running pass {pass_num + 1}/{self.num_passes}")

            try:
                result = self._run_synthesis_pass(
                    digests_summary=digests_summary,
                    similarity_report=similarity_report,
                    disciplina=disciplina,
                    banca=banca,
                    anos=anos,
                    total_questoes=total_questoes,
                    pass_num=pass_num
                )

                all_patterns.extend(result.get("patterns", []))
                all_reports.append(result.get("report_text", ""))
                all_recommendations.extend(result.get("study_recommendations", []))

            except Exception as e:
                logger.error(f"Pass {pass_num + 1} failed: {e}")

        # Consolidate with majority voting
        consolidated = self._consolidate_patterns(all_patterns)

        # Generate final report
        return self._build_final_report(
            consolidated_patterns=consolidated,
            all_reports=all_reports,
            all_recommendations=all_recommendations,
            disciplina=disciplina,
            total_questoes=total_questoes,
            chunk_digests=chunk_digests
        )

    def _format_digests(self, chunk_digests: list[ChunkDigest]) -> str:
        """Format chunk digests for prompt"""
        summaries = []
        for digest in chunk_digests:
            patterns_text = "; ".join([
                f"{p['type']}: {p['description']}"
                for p in digest.patterns_found
            ]) if digest.patterns_found else "Nenhum padrao identificado"

            summaries.append(f"- Chunk {digest.chunk_id}: {digest.summary} | Padroes: {patterns_text}")

        return "\n".join(summaries)

    def _run_synthesis_pass(
        self,
        digests_summary: str,
        similarity_report: dict,
        disciplina: str,
        banca: str,
        anos: list[int],
        total_questoes: int,
        pass_num: int
    ) -> dict:
        """Run a single synthesis pass"""

        prompt = f"""<system>
Voce e um especialista senior em psicometria e analise de bancas de concursos.
Sua tarefa e sintetizar padroes globais a partir de analises parciais.
Passe {pass_num + 1}: Busque padroes que podem ter sido ignorados em passes anteriores.
</system>

<input>
<similarity_report>
{json.dumps(similarity_report, ensure_ascii=False, indent=2)}
</similarity_report>

<chunk_digests>
{digests_summary}
</chunk_digests>

<metadata>
Total de questoes: {total_questoes}
Disciplina: {disciplina}
Anos cobertos: {', '.join(map(str, sorted(anos)))}
Banca: {banca}
</metadata>
</input>

<task>
Sintetize um relatorio analitico profundo cobrindo:

1. PADROES TEMPORAIS
   - Como cada topico evoluiu ao longo dos anos?
   - Ha topicos que "sumiram" ou "apareceram" recentemente?

2. QUESTOES SIMILARES/REPETIDAS
   - Use o similarity_report como evidencia concreta
   - A banca esta "reciclando" questoes? De que forma?

3. ANALISE DE DIFICULDADE
   - Quais topicos sao consistentemente dificeis?
   - Houve evolucao de dificuldade ao longo dos anos?

4. PEGADINHAS RECORRENTES
   - Quais armadilhas a banca usa repetidamente?
   - Ha padrao de pegadinha por topico?

5. IMPLICACOES PARA ESTUDO
   - O que o candidato deve priorizar?
   - Quais conceitos sao "obrigatorios"?

Para cada afirmacao, cite evidencias especificas (IDs de questoes, anos, contagens).

Responda em JSON:
{{
    "patterns": [
        {{"type": "temporal|similaridade|dificuldade|estilo|pegadinha", "description": "string", "evidence_ids": ["Q001"], "confidence": "high|medium|low"}}
    ],
    "report_text": "Texto completo do relatorio analitico",
    "study_recommendations": ["recomendacao 1", "recomendacao 2"]
}}
</task>"""

        response = self.llm.generate(
            prompt,
            temperature=self.temperature,
            max_tokens=4000,
            preferred_provider="anthropic"
        )

        # Extract text content from response dict
        response_text = response.get("text", "") if isinstance(response, dict) else str(response)

        # Parse response
        return self._parse_synthesis_response(response_text)

    def _parse_synthesis_response(self, response: str) -> dict:
        """Parse synthesis response from LLM"""
        try:
            # Extract JSON from response
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0].strip()

            return json.loads(json_str)
        except (json.JSONDecodeError, IndexError) as e:
            logger.warning(f"Failed to parse synthesis response: {e}")
            return {"patterns": [], "report_text": response, "study_recommendations": []}

    def _consolidate_patterns(self, all_patterns: list[dict]) -> list[PatternFinding]:
        """Consolidate patterns using majority voting"""
        # Group similar patterns
        pattern_groups: dict[str, dict] = {}

        for p in all_patterns:
            # Create a key based on type and description similarity
            key = f"{p.get('type', 'unknown')}:{p.get('description', '')[:50]}"

            if key not in pattern_groups:
                pattern_groups[key] = {
                    "pattern_type": p.get("type", "unknown"),
                    "description": p.get("description", ""),
                    "evidence_ids": set(),
                    "votes": 0
                }

            pattern_groups[key]["votes"] += 1
            for eid in p.get("evidence_ids", []):
                pattern_groups[key]["evidence_ids"].add(eid)

        # Convert to PatternFinding with confidence based on votes
        findings = []
        for key, data in pattern_groups.items():
            confidence = "low"
            if data["votes"] >= self.VOTING_THRESHOLD_HIGH:
                confidence = "high"
            elif data["votes"] >= self.VOTING_THRESHOLD_MEDIUM:
                confidence = "medium"

            findings.append(PatternFinding(
                pattern_type=data["pattern_type"],
                description=data["description"],
                evidence_ids=list(data["evidence_ids"]),
                confidence=confidence,
                votes=data["votes"]
            ))

        # Sort by votes descending
        findings.sort(key=lambda x: x.votes, reverse=True)

        logger.info(f"Consolidated {len(all_patterns)} patterns into {len(findings)} findings")
        return findings

    def _build_final_report(
        self,
        consolidated_patterns: list[PatternFinding],
        all_reports: list[str],
        all_recommendations: list[str],
        disciplina: str,
        total_questoes: int,
        chunk_digests: list[ChunkDigest]
    ) -> AnalysisReport:
        """Build the final AnalysisReport"""

        # Categorize patterns
        temporal = [p for p in consolidated_patterns if p.pattern_type == "temporal"]
        similarity = [p for p in consolidated_patterns if p.pattern_type == "similaridade"]

        # Aggregate difficulty from chunk digests
        difficulty_counts: Counter = Counter()
        trap_counts: Counter = Counter()

        for digest in chunk_digests:
            for qa in digest.questions_analysis:
                difficulty_counts[qa.difficulty] += 1
                if qa.has_trap and qa.trap_description:
                    trap_counts[qa.trap_description[:30]] += 1

        # Deduplicate recommendations
        unique_recommendations = list(dict.fromkeys(all_recommendations))

        # Combine all report texts
        combined_report = "\n\n---\n\n".join([r for r in all_reports if r])

        return AnalysisReport(
            disciplina=disciplina,
            total_questoes=total_questoes,
            temporal_patterns=temporal,
            similarity_patterns=similarity,
            difficulty_analysis=dict(difficulty_counts),
            trap_analysis=dict(trap_counts),
            study_recommendations=unique_recommendations or ["Aguardando analise completa"],
            raw_text=combined_report[:10000]  # Limit size
        )
