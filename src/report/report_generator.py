"""
Report generator - orchestrates report generation
"""
from datetime import datetime
from pathlib import Path
from typing import Optional

from loguru import logger

from src.core.config import get_settings
from src.core.exceptions import ReportError

settings = get_settings()


class ReportGenerator:
    """Orchestrates report generation"""

    def __init__(self):
        self.output_dir = settings.outputs_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_disciplina_report(
        self,
        disciplina: str,
        questoes: list[dict],
        classificacoes: list[dict],
        similaridades: Optional[list[tuple]] = None,
        clusters: Optional[list[dict]] = None,
    ) -> str:
        """
        Generate detailed report for a specific disciplina

        Args:
            disciplina: Disciplina name (e.g., "Português")
            questoes: List of question dicts
            classificacoes: List of classification dicts
            similaridades: Optional similarity pairs
            clusters: Optional clusters

        Returns:
            str: Path to generated markdown report

        Raises:
            ReportError: If generation fails
        """
        try:
            logger.info(f"Generating report for disciplina: {disciplina}")

            # Build report content
            report_md = self._build_disciplina_report_markdown(
                disciplina, questoes, classificacoes, similaridades, clusters
            )

            # Save to file
            filename = f"{disciplina.lower().replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
            output_path = self.output_dir / "relatorios_md" / filename
            output_path.parent.mkdir(parents=True, exist_ok=True)

            with open(output_path, "w", encoding="utf-8") as f:
                f.write(report_md)

            logger.info(f"Report saved: {output_path}")
            return str(output_path)

        except Exception as e:
            logger.error(f"Failed to generate report: {e}")
            raise ReportError(f"Report generation failed: {e}")

    def _build_disciplina_report_markdown(
        self,
        disciplina: str,
        questoes: list[dict],
        classificacoes: list[dict],
        similaridades: Optional[list[tuple]],
        clusters: Optional[list[dict]],
    ) -> str:
        """Build markdown content for disciplina report"""

        md = f"""# Análise Detalhada - {disciplina}

**Data de Geração:** {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}
**Total de Questões:** {len(questoes)}

---

## 1. Panorama Geral

### Distribuição por Assunto

"""

        # Count by assunto
        assunto_counts = {}
        for c in classificacoes:
            assunto = c.get("assunto", "Não classificado")
            assunto_counts[assunto] = assunto_counts.get(assunto, 0) + 1

        # Sort by count desc
        sorted_assuntos = sorted(assunto_counts.items(), key=lambda x: x[1], reverse=True)

        for assunto, count in sorted_assuntos:
            percentage = (count / len(questoes)) * 100
            md += f"- **{assunto}:** {count} questões ({percentage:.1f}%)\n"

        md += "\n---\n\n"

        # Detailed analysis by assunto
        md += "## 2. Análise Detalhada por Assunto\n\n"

        for assunto, count in sorted_assuntos[:5]:  # Top 5 assuntos
            md += f"### 2.{sorted_assuntos.index((assunto, count)) + 1} {assunto}\n\n"
            md += f"**Incidência:** {count} questões ({(count/len(questoes))*100:.1f}%)\n\n"

            # Find questions of this assunto
            assunto_questoes = [
                q
                for q in questoes
                if any(
                    c.get("questao_numero") == q.get("numero") and c.get("assunto") == assunto
                    for c in classificacoes
                )
            ]

            if assunto_questoes:
                md += "**Questões:**\n"
                for q in assunto_questoes[:3]:  # Show first 3
                    md += f"- Q{q.get('numero')}: {q.get('enunciado')[:100]}...\n"
                md += "\n"

        md += "\n---\n\n"

        # Similarity analysis
        if similaridades:
            md += "## 3. Padrões e Questões Similares\n\n"
            md += f"Foram identificados **{len(similaridades)} pares** de questões com alta similaridade (>75%).\n\n"

            for i, (q1_id, q2_id, score) in enumerate(similaridades[:5], 1):
                md += f"### Cluster de Similaridade {i}\n"
                md += f"- Similaridade: {score:.1%}\n"
                md += f"- Questões: {q1_id} ↔ {q2_id}\n\n"

        md += "\n---\n\n"

        # Recommendations
        md += "## 4. Recomendações de Estudo\n\n"
        md += "Com base na análise de incidência, recomenda-se priorizar:\n\n"

        for i, (assunto, count) in enumerate(sorted_assuntos[:3], 1):
            percentage = (count / len(questoes)) * 100
            if percentage > 20:
                prioridade = "ALTA"
            elif percentage > 10:
                prioridade = "MÉDIA"
            else:
                prioridade = "BAIXA"

            md += f"{i}. **{assunto}** (Prioridade {prioridade})\n"
            md += f"   - Incidência: {percentage:.1f}%\n"
            md += f"   - Tempo sugerido de estudo: {int(percentage * 0.5)} horas\n\n"

        md += "\n---\n\n"
        md += f"*Relatório gerado automaticamente pelo Analisador de Questões v0.1.0*\n"

        return md
