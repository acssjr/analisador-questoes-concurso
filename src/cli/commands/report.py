"""
Report command - generate detailed reports
"""
import json
from pathlib import Path

import typer
from rich.console import Console

from src.report.report_generator import ReportGenerator

console = Console()
app = typer.Typer()


@app.command()
def generate(
    input_file: Path = typer.Argument(..., help="JSON file with classified questions"),
    disciplina: str = typer.Option(..., help="Disciplina to generate report for"),
    output: Path = typer.Option(None, help="Output markdown file path"),
):
    """
    Generate detailed report for a disciplina

    Example:
        analisador report generate data/processed/questoes_classificadas.json --disciplina "Português"
    """
    try:
        # Load data
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        questoes = data.get("questoes", [])
        classificacoes = data.get("classificacoes", [])

        # Filter by disciplina
        questoes_filtradas = [
            q for q in questoes if q.get("disciplina") == disciplina
        ]
        classificacoes_filtradas = [
            c for c in classificacoes if c.get("disciplina") == disciplina
        ]

        if not questoes_filtradas:
            console.print(
                f"[bold red]No questions found for disciplina:[/bold red] {disciplina}"
            )
            raise typer.Exit(1)

        console.print(
            f"[bold blue]Generating report for {disciplina}...[/bold blue] ({len(questoes_filtradas)} questions)\n"
        )

        # Load similaridades if available
        similaridades_file = input_file.parent / f"{input_file.stem}_similaridades.json"
        similaridades = None
        if similaridades_file.exists():
            with open(similaridades_file, "r", encoding="utf-8") as f:
                sim_data = json.load(f)
                similaridades = [
                    (p["q1"], p["q2"], p["similarity"]) for p in sim_data.get("pairs", [])
                ]

        # Generate report
        generator = ReportGenerator()
        report_path = generator.generate_disciplina_report(
            disciplina=disciplina,
            questoes=questoes_filtradas,
            classificacoes=classificacoes_filtradas,
            similaridades=similaridades,
        )

        console.print(f"[bold green]✓ Report generated![/bold green]")
        console.print(f"Saved to: [bold]{report_path}[/bold]")

        # Show preview
        with open(report_path, "r", encoding="utf-8") as f:
            preview = f.read()[:500]

        console.print(f"\n[bold]Preview:[/bold]\n{preview}...\n")

    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {e}")
        raise typer.Exit(1)
