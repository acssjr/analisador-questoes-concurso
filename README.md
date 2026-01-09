# Analisador de Questões de Concurso

Sistema de análise forense de questões de concurso usando IA para detectar padrões, classificar por taxonomia hierárquica e gerar relatórios ultra-detalhados.

## Features

### Backend
- ✅ Extração inteligente de PDFs (PCI Concursos + formato genérico)
- ✅ Classificação hierárquica multi-nível (Disciplina → Assunto → Tópico → Subtópico → Conceito)
- ✅ Análise multimodal (texto + imagens com geometria, charges, gráficos)
- ✅ Detecção de padrões e similaridade semântica
- ✅ Clustering de questões similares
- ✅ Tratamento especial de questões anuladas
- ✅ Relatórios ultra-detalhados em Markdown/PDF
- ✅ API REST completa com FastAPI
- ✅ CLI para processamento batch

### Frontend (Data Lab Interface)
- ✅ Interface inovadora "Laboratório de Dados Científico"
- ✅ Modo Insights: Visão automática com cards, distribuições e alertas
- ✅ Modo Laboratório: 4 tabs de análise avançada
  - Tab Distribuição: Treemap hierárquico interativo (Recharts)
  - Tab Temporal: Timeline de evolução ao longo dos anos
  - Tab Similaridade: Clusters de questões similares
  - Tab Questões: Tabela master com busca e filtros
- ✅ Upload de PDF com drag-and-drop e progress tracking
- ✅ Sistema de notificações toast + dropdown
- ✅ Painel de análise com classificação hierárquica completa
- ✅ Filtros globais (status, anos, bancas)
- ✅ Dark mode científico com animações suaves

## Tech Stack

### Backend
- **Python 3.11+**, FastAPI
- **Database:** PostgreSQL 16 + pgvector (ou SQLite)
- **LLMs:** Groq (Llama 3.3 70B), Hugging Face, Claude (multimodal)
- **ML:** sentence-transformers, scikit-learn
- **PDF:** PyMuPDF, pdfplumber, Tesseract OCR

### Frontend
- **React 19** + TypeScript 5.7
- **Vite** para build/dev
- **TailwindCSS v4** para styling
- **Zustand** para state management
- **Recharts** para gráficos interativos

## Quick Start

### 1. Install dependencies

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install with uv (recommended)
pip install uv
uv pip install -e .

# Or with pip
pip install -e .
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Setup database

```bash
# PostgreSQL (recommended)
python scripts/setup_db.py

# Or use SQLite (no setup needed)
```

### 4. Run CLI

```bash
# Extract questions from PDF
analisador extract data/raw/provas/prova.pdf

# Classify questions
analisador classify --disciplina "Português"

# Generate report
analisador report --disciplina "Português" --output data/outputs/relatorios_md/portugues.md
```

### 5. Run API

```bash
uvicorn src.api.main:app --reload
# API docs: http://localhost:8000/docs
```

### 6. Run Frontend (Interface Web)

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Access: http://localhost:5173
```

**Features do Frontend:**
- Modo Insights com visão automática
- Modo Laboratório com gráficos interativos
- Upload de PDF via drag-and-drop
- Notificações em tempo real
- Painel de análise detalhada por questão

Ver documentação completa em `frontend/README.md`

## Project Structure

```
analisador-questoes-concurso/
├── src/                # Backend Python
│   ├── core/          # Config, database, logging
│   ├── models/        # SQLAlchemy models
│   ├── schemas/       # Pydantic schemas
│   ├── extraction/    # PDF parsing
│   ├── llm/           # LLM integrations
│   ├── classification/# Classification pipeline
│   ├── analysis/      # Pattern detection, clustering
│   ├── report/        # Report generation
│   ├── api/           # FastAPI routes
│   └── cli/           # CLI commands
├── frontend/          # Frontend React
│   ├── src/
│   │   ├── components/  # UI components
│   │   │   ├── ui/      # Design system (Button, Badge, Card, Modal)
│   │   │   ├── charts/  # Gráficos (Treemap, Timeline)
│   │   │   ├── features/# Upload, Notifications, AnalysisPanel
│   │   │   └── layout/  # Topbar, Sidebar, MainLayout
│   │   ├── pages/       # Insights, Laboratory
│   │   ├── store/       # Zustand state management
│   │   ├── services/    # API client
│   │   ├── types/       # TypeScript types
│   │   └── utils/       # Helpers (colors, calculations)
│   └── docs/plans/      # Design documentation
├── data/              # Dados processados
├── scripts/           # Setup scripts
└── docs/              # Documentação
```

## Documentation

### Backend
- [Getting Started](GETTING_STARTED.md)
- [API Documentation](http://localhost:8000/docs) (quando API rodando)

### Frontend
- [Frontend README](frontend/README.md)
- [Design Documentation](frontend/docs/plans/2026-01-08-frontend-data-lab-design.md)
- [Deploy Guide](frontend/DEPLOY.md)

## Demo

### Screenshots

**Modo Insights:**
- Overview cards com estatísticas
- Distribuição visual por assunto
- Alertas de questões anuladas

**Modo Laboratório:**
- Tab Distribuição com Treemap hierárquico
- Tab Temporal com linha do tempo
- Tab Questões com tabela interativa

**Upload de PDF:**
- Drag-and-drop com preview
- Progress tracking em tempo real
- Notificações de sucesso/erro

## Roadmap

- [x] Backend completo com FastAPI
- [x] CLI para processamento batch
- [x] Frontend Data Lab Interface
- [x] Upload de PDF
- [x] Gráficos interativos
- [x] Sistema de notificações
- [ ] Autenticação de usuários (opcional)
- [ ] Exportação de relatórios PDF/Excel
- [ ] PWA para acesso offline
- [ ] Testes automatizados (backend + frontend)

## Status

✅ **Production Ready**

- Build de produção funcionando
- TypeScript sem erros
- API REST completa
- Frontend totalmente funcional
- Documentação completa

## License

MIT
