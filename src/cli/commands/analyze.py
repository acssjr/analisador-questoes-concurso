"""
Analyze command - analyze patterns and similarity
"""
import json
from pathlib import Path

import typer
from rich.console import Console

from src.analysis.embeddings import EmbeddingGenerator
from src.analysis.similarity import find_most_similar_pairs

console = Console()
app = typer.Typer()


@app.command()
def similarity(
    input_file: Path = typer.Argument(..., help="JSON file with classified questions"),
    threshold: float = typer.Option(0.75, help="Similarity threshold (0.0-1.0)"),
    top_k: int = typer.Option(20, help="Max number of similar pairs to find"),
):
    """
    Find similar questions using embeddings

    Example:
        analisador analyze similarity data/processed/questoes_classificadas.json
    """
    try:
        # Load data
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        questoes = data.get("questoes", [])

        console.print(f"[bold blue]Analyzing {len(questoes)} questions...[/bold blue]\n")

        # Generate embeddings
        console.print("🔄 Generating embeddings...")
        generator = EmbeddingGenerator()

        embeddings = []
        questao_ids = []

        for q in questoes:
            embedding = generator.generate_question_embedding(q, tipo="enunciado_completo")
            embeddings.append(embedding)
            questao_ids.append(str(q.get("numero")))

        console.print("✓ Embeddings generated\n")

        # Find similar pairs
        console.print(f"🔍 Finding similar pairs (threshold={threshold})...")
        similar_pairs = find_most_similar_pairs(embeddings, questao_ids, threshold, top_k)

        if not similar_pairs:
            console.print("[yellow]No similar pairs found[/yellow]")
            return

        console.print(f"\n[bold green]✓ Found {len(similar_pairs)} similar pairs:[/bold green]\n")

        for q1, q2, score in similar_pairs:
            console.print(f"• Q{q1} ↔ Q{q2}: {score:.2%} similarity")

        # Save results
        output = input_file.parent / f"{input_file.stem}_similaridades.json"
        with open(output, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "threshold": threshold,
                    "total_pairs": len(similar_pairs),
                    "pairs": [
                        {"q1": q1, "q2": q2, "similarity": score}
                        for q1, q2, score in similar_pairs
                    ],
                },
                f,
                ensure_ascii=False,
                indent=2,
            )

        console.print(f"\n✓ Saved to: [bold]{output}[/bold]")

    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {e}")
        raise typer.Exit(1)
