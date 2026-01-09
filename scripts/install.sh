#!/bin/bash
# Installation script for Unix-like systems

echo "🚀 Installing Analisador de Questões de Concurso..."

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Python version: $python_version"

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install uv (fast package manager)
echo "📦 Installing uv package manager..."
pip install uv

# Install dependencies
echo "📦 Installing dependencies..."
uv pip install -e .

# Copy .env.example to .env if not exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your API keys"
fi

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/raw/provas data/raw/gabaritos data/raw/editais
mkdir -p data/processed/questoes_extraidas data/processed/imagens data/processed/embeddings
mkdir -p data/outputs/relatorios_md data/outputs/relatorios_pdf data/outputs/exports

# Setup database
echo "🗄️  Setting up database..."
python scripts/setup_db.py

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your API keys"
echo "2. Run: source venv/bin/activate"
echo "3. Try: analisador --help"
echo ""
