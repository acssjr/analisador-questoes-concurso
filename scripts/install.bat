@echo off
REM Installation script for Windows

echo Installing Analisador de Questoes de Concurso...

REM Check Python
python --version
if errorlevel 1 (
    echo Error: Python not found
    exit /b 1
)

REM Create virtual environment
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install uv
echo Installing uv package manager...
pip install uv

REM Install dependencies
echo Installing dependencies...
uv pip install -e .

REM Copy .env.example
if not exist ".env" (
    echo Creating .env file...
    copy .env.example .env
    echo Please edit .env and add your API keys
)

REM Create data directories
echo Creating data directories...
mkdir data\raw\provas 2>nul
mkdir data\raw\gabaritos 2>nul
mkdir data\raw\editais 2>nul
mkdir data\processed\questoes_extraidas 2>nul
mkdir data\processed\imagens 2>nul
mkdir data\processed\embeddings 2>nul
mkdir data\outputs\relatorios_md 2>nul
mkdir data\outputs\relatorios_pdf 2>nul
mkdir data\outputs\exports 2>nul

REM Setup database
echo Setting up database...
python scripts\setup_db.py

echo.
echo Installation complete!
echo.
echo Next steps:
echo 1. Edit .env and add your API keys
echo 2. Run: venv\Scripts\activate.bat
echo 3. Try: analisador --help
echo.

pause
