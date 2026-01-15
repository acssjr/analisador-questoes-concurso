"""
CLI application using Typer
"""

import typer
from rich.console import Console

from src.cli.commands import analyze, classify, extract, report

console = Console()

app = typer.Typer(
    name="analisador",
    help="Analisador de Questões de Concurso - CLI",
    add_completion=False,
)

# Add commands
app.add_typer(extract.app, name="extract", help="Extract questions from PDF")
app.add_typer(classify.app, name="classify", help="Classify extracted questions")
app.add_typer(analyze.app, name="analyze", help="Analyze patterns and similarity")
app.add_typer(report.app, name="report", help="Generate detailed reports")


@app.command()
def version():
    """Show version"""
    console.print("[bold green]Analisador de Questões v0.1.0[/bold green]")


if __name__ == "__main__":
    app()
