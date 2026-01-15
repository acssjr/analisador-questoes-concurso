"""
Extract command - extract questions from PDFs
"""

import json
from pathlib import Path

import typer
from rich.console import Console
from rich.progress import track

from src.extraction.pci_parser import parse_pci_pdf
from src.extraction.pdf_detector import detect_pdf_format

console = Console()
app = typer.Typer()


@app.command()
def pdf(
    pdf_path: Path = typer.Argument(..., help="Path to PDF file"),
    output: Path = typer.Option(None, help="Output JSON file path"),
):
    """
    Extract questions from a PDF file

    Example:
        analisador extract pdf data/raw/provas/fcc_2024.pdf
    """
    try:
        console.print(f"[bold blue]Extracting questions from:[/bold blue] {pdf_path}")

        # Check file exists
        if not pdf_path.exists():
            console.print(f"[bold red]Error:[/bold red] File not found: {pdf_path}")
            raise typer.Exit(1)

        # Detect format
        console.print("🔍 Detecting PDF format...")
        format_type = detect_pdf_format(pdf_path)
        console.print(f"✓ Format detected: [bold green]{format_type}[/bold green]")

        # Extract
        console.print("📄 Extracting questions...")
        if format_type == "PCI":
            result = parse_pci_pdf(pdf_path)
        else:
            console.print(f"[bold red]Error:[/bold red] Format {format_type} not supported yet")
            raise typer.Exit(1)

        # Show summary
        console.print("\n[bold green]✓ Extraction complete![/bold green]")
        console.print(f"Total questions: {len(result['questoes'])}")
        console.print(f"Banca: {result['metadados'].get('banca', 'N/A')}")
        console.print(f"Cargo: {result['metadados'].get('cargo', 'N/A')}")
        console.print(f"Ano: {result['metadados'].get('ano', 'N/A')}")

        # Count by disciplina
        disciplinas = {}
        for q in result["questoes"]:
            disc = q.get("disciplina", "Unknown")
            disciplinas[disc] = disciplinas.get(disc, 0) + 1

        console.print("\n[bold]Distribution by disciplina:[/bold]")
        for disc, count in sorted(disciplinas.items(), key=lambda x: x[1], reverse=True):
            console.print(f"  • {disc}: {count} questions")

        # Save to JSON
        if not output:
            output = Path(f"data/processed/questoes_extraidas/{pdf_path.stem}.json")
        output.parent.mkdir(parents=True, exist_ok=True)

        with open(output, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        console.print(f"\n✓ Saved to: [bold]{output}[/bold]")

    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {e}")
        raise typer.Exit(1)


@app.command()
def batch(
    input_dir: Path = typer.Argument(..., help="Directory with PDF files"),
    output_dir: Path = typer.Option("data/processed/questoes_extraidas", help="Output directory"),
):
    """
    Extract questions from multiple PDFs

    Example:
        analisador extract batch data/raw/provas/
    """
    try:
        pdf_files = list(input_dir.glob("*.pdf"))

        if not pdf_files:
            console.print(f"[bold red]Error:[/bold red] No PDF files found in {input_dir}")
            raise typer.Exit(1)

        console.print(f"[bold blue]Found {len(pdf_files)} PDF files[/bold blue]\n")

        for pdf_path in track(pdf_files, description="Extracting..."):
            try:
                result = parse_pci_pdf(pdf_path)

                output = output_dir / f"{pdf_path.stem}.json"
                output.parent.mkdir(parents=True, exist_ok=True)

                with open(output, "w", encoding="utf-8") as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)

                console.print(f"✓ {pdf_path.name}: {len(result['questoes'])} questions extracted")

            except Exception as e:
                console.print(f"✗ {pdf_path.name}: [red]{e}[/red]")

        console.print("\n[bold green]✓ Batch extraction complete![/bold green]")

    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {e}")
        raise typer.Exit(1)
