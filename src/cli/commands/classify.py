"""
Classify command - classify extracted questions
"""
import json
from pathlib import Path

import typer
from rich.console import Console
from rich.progress import track

from src.classification.classifier import QuestionClassifier

console = Console()
app = typer.Typer()


@app.command()
def questions(
    input_file: Path = typer.Argument(..., help="JSON file with extracted questions"),
    output: Path = typer.Option(None, help="Output JSON file with classifications"),
    disciplina: str = typer.Option(None, help="Filter by disciplina"),
):
    """
    Classify questions using LLM

    Example:
        analisador classify questions data/processed/questoes_extraidas/prova.json --disciplina "Português"
    """
    try:
        # Load questions
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        questoes = data.get("questoes", [])

        # Filter by disciplina if specified
        if disciplina:
            questoes = [q for q in questoes if q.get("disciplina") == disciplina]
            console.print(
                f"[bold blue]Filtering by disciplina:[/bold blue] {disciplina} ({len(questoes)} questions)"
            )

        if not questoes:
            console.print("[bold red]No questions to classify[/bold red]")
            raise typer.Exit(1)

        console.print(f"\n[bold blue]Classifying {len(questoes)} questions...[/bold blue]\n")

        # Initialize classifier
        classifier = QuestionClassifier()

        # Classify
        classificacoes = []
        for questao in track(questoes, description="Classifying..."):
            try:
                result = classifier.classify_question(questao)
                classificacoes.append(result)
                console.print(
                    f"✓ Q{questao.get('numero')}: {result.get('disciplina')} → {result.get('assunto')} → {result.get('topico')}"
                )
            except Exception as e:
                console.print(f"✗ Q{questao.get('numero')}: [red]{e}[/red]")

        # Save results
        if not output:
            output = input_file.parent / f"{input_file.stem}_classificacoes.json"

        with open(output, "w", encoding="utf-8") as f:
            json.dump(
                {"questoes": questoes, "classificacoes": classificacoes},
                f,
                ensure_ascii=False,
                indent=2,
            )

        console.print(f"\n[bold green]✓ Classification complete![/bold green]")
        console.print(f"Saved to: [bold]{output}[/bold]")

    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {e}")
        raise typer.Exit(1)
