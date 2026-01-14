"""
CoVe Service - Phase 4 of the Deep Analysis Pipeline
Chain-of-Verification for validating analysis claims
Based on Dhuliawala et al. (arXiv 2309.11495)
"""
from dataclasses import dataclass
from typing import Optional
import json
from loguru import logger

from src.llm.llm_orchestrator import LLMOrchestrator


@dataclass
class VerificationResult:
    """Result of verifying a single claim"""
    claim: str
    verification_question: str
    evidence_ids: list[str]  # Question IDs used as evidence
    evidence_summary: str
    is_verified: bool
    confidence: str  # 'high', 'medium', 'low'
    notes: Optional[str] = None


@dataclass
class VerifiedReport:
    """Report after Chain-of-Verification"""
    original_claims: int
    verified_claims: int
    rejected_claims: int
    verification_results: list[VerificationResult]
    cleaned_report: str  # Report with unverified claims removed/flagged


class CoVeService:
    """
    Chain-of-Verification Service for Phase 4

    Process (from Dhuliawala et al.):
    1. Extract claims from analysis report
    2. For each claim, generate verification question
    3. Search evidence in original questions
    4. Validate if evidence supports the claim
    5. Remove or flag claims that fail validation
    """

    def __init__(self, llm: Optional[LLMOrchestrator] = None):
        self.llm = llm or LLMOrchestrator()

    def verify_report(
        self,
        report_text: str,
        questoes: list[dict],
        max_claims: int = 20
    ) -> VerifiedReport:
        """
        Verify claims in an analysis report

        Args:
            report_text: The analysis report to verify
            questoes: Original questions for evidence lookup
            max_claims: Maximum number of claims to verify

        Returns:
            VerifiedReport with verification results
        """
        logger.info("Starting Chain-of-Verification for report")

        # Step 1: Extract claims from report
        claims = self._extract_claims(report_text, max_claims)
        logger.info(f"Extracted {len(claims)} claims to verify")

        # Step 2: Verify each claim
        verification_results = []
        verified_count = 0
        rejected_count = 0

        for claim in claims:
            result = self._verify_claim(claim, questoes)
            verification_results.append(result)

            if result.is_verified:
                verified_count += 1
            else:
                rejected_count += 1

        # Step 3: Generate cleaned report
        cleaned_report = self._generate_cleaned_report(
            report_text,
            verification_results
        )

        logger.info(f"Verification complete: {verified_count} verified, {rejected_count} rejected")

        return VerifiedReport(
            original_claims=len(claims),
            verified_claims=verified_count,
            rejected_claims=rejected_count,
            verification_results=verification_results,
            cleaned_report=cleaned_report
        )

    def _extract_claims(self, report_text: str, max_claims: int) -> list[str]:
        """Extract verifiable claims from report text"""
        prompt = f"""<task>
Extraia afirmacoes verificaveis do seguinte relatorio de analise.
Foque em afirmacoes que citam dados especificos, padroes, ou conclusoes.
Retorne no maximo {max_claims} afirmacoes mais importantes.
</task>

<report>
{report_text[:4000]}
</report>

<output_format>
Retorne um JSON com lista de claims:
{{"claims": ["afirmacao 1", "afirmacao 2", ...]}}
</output_format>"""

        response = self.llm.generate(
            prompt,
            temperature=0.1,
            max_tokens=2000,
            preferred_provider="anthropic"
        )

        # Extract text content from response dict
        response_text = response.get("text", "") if isinstance(response, dict) else str(response)

        try:
            data = self._parse_json_response(response_text)
            return data.get("claims", [])[:max_claims]
        except Exception as e:
            logger.warning(f"Failed to extract claims: {e}")
            return []

    def _verify_claim(self, claim: str, questoes: list[dict]) -> VerificationResult:
        """Verify a single claim against original questions"""

        # Step 1: Generate verification question
        verification_question = self._generate_verification_question(claim)

        # Step 2: Find relevant evidence
        evidence_ids, evidence_summary = self._find_evidence(
            verification_question,
            questoes
        )

        # Step 3: Validate claim against evidence
        is_verified, confidence, notes = self._validate_claim(
            claim,
            evidence_summary
        )

        return VerificationResult(
            claim=claim,
            verification_question=verification_question,
            evidence_ids=evidence_ids,
            evidence_summary=evidence_summary,
            is_verified=is_verified,
            confidence=confidence,
            notes=notes
        )

    def _generate_verification_question(self, claim: str) -> str:
        """Generate a verification question for a claim"""
        prompt = f"""<task>
Gere uma pergunta de verificacao para a seguinte afirmacao.
A pergunta deve permitir validar se a afirmacao e verdadeira
com base em dados concretos das questoes.
</task>

<claim>
{claim}
</claim>

<output_format>
Retorne apenas a pergunta de verificacao, sem explicacoes.
</output_format>"""

        response = self.llm.generate(
            prompt,
            temperature=0.1,
            max_tokens=200,
            preferred_provider="anthropic"
        )

        # Extract text content from response dict
        response_text = response.get("text", "") if isinstance(response, dict) else str(response)

        return response_text.strip()

    def _find_evidence(
        self,
        verification_question: str,
        questoes: list[dict]
    ) -> tuple[list[str], str]:
        """Find evidence in original questions"""

        # Create a summary of questions for search
        questoes_summary = []
        for q in questoes[:50]:  # Limit to first 50 for context window
            q_id = q.get("id", q.get("numero", "?"))
            enunciado = q.get("enunciado", "")[:200]
            disciplina = q.get("disciplina", "")
            questoes_summary.append(f"[{q_id}] ({disciplina}) {enunciado}")

        prompt = f"""<task>
Encontre questoes que servem como evidencia para responder esta pergunta.
</task>

<question>
{verification_question}
</question>

<available_questions>
{chr(10).join(questoes_summary)}
</available_questions>

<output_format>
Retorne JSON:
{{
    "evidence_ids": ["id1", "id2"],
    "summary": "resumo das evidencias encontradas"
}}
</output_format>"""

        response = self.llm.generate(
            prompt,
            temperature=0.1,
            max_tokens=500,
            preferred_provider="anthropic"
        )

        # Extract text content from response dict
        response_text = response.get("text", "") if isinstance(response, dict) else str(response)

        try:
            data = self._parse_json_response(response_text)
            return (
                data.get("evidence_ids", []),
                data.get("summary", "Sem evidencias encontradas")
            )
        except Exception:
            return [], "Falha ao buscar evidencias"

    def _validate_claim(
        self,
        claim: str,
        evidence_summary: str
    ) -> tuple[bool, str, Optional[str]]:
        """Validate if evidence supports the claim"""

        prompt = f"""<task>
Valide se a evidencia sustenta a afirmacao.
Seja rigoroso: apenas confirme se ha evidencia clara.
</task>

<claim>
{claim}
</claim>

<evidence>
{evidence_summary}
</evidence>

<output_format>
Retorne JSON:
{{
    "is_verified": true/false,
    "confidence": "high|medium|low",
    "notes": "explicacao opcional"
}}
</output_format>"""

        response = self.llm.generate(
            prompt,
            temperature=0.1,
            max_tokens=300,
            preferred_provider="anthropic"
        )

        # Extract text content from response dict
        response_text = response.get("text", "") if isinstance(response, dict) else str(response)

        try:
            data = self._parse_json_response(response_text)
            return (
                data.get("is_verified", False),
                data.get("confidence", "low"),
                data.get("notes")
            )
        except Exception:
            return False, "low", "Falha na validacao"

    def _generate_cleaned_report(
        self,
        original_report: str,
        verification_results: list[VerificationResult]
    ) -> str:
        """Generate report with unverified claims flagged"""

        # Find rejected claims
        rejected_claims = [
            r.claim for r in verification_results if not r.is_verified
        ]

        if not rejected_claims:
            return original_report

        # Add warning section
        warnings = "\n".join([f"- {c[:100]}..." for c in rejected_claims])

        cleaned = f"""AVISO: As seguintes afirmacoes nao puderam ser verificadas:
{warnings}

---

{original_report}"""

        return cleaned

    def _parse_json_response(self, response: str) -> dict:
        """Parse JSON from LLM response"""
        json_str = response
        if "```json" in response:
            json_str = response.split("```json")[1].split("```")[0].strip()
        elif "```" in response:
            json_str = response.split("```")[1].split("```")[0].strip()

        return json.loads(json_str)
