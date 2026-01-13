# Analisador de Questoes de Concurso

Sistema para analise de **incidencia de assuntos** em provas de concursos publicos. Utiliza IA para extrair conteudo programatico de editais, processar questoes de provas anteriores e gerar analises de frequencia por topico.

## Funcionalidades

- **Extracao de Editais**: Processa PDFs de editais e extrai taxonomia hierarquica do conteudo programatico
- **Processamento de Provas**: Extrai questoes de PDFs de provas anteriores (formato PCI Concursos e generico)
- **Classificacao Inteligente**: Classifica cada questao de acordo com a taxonomia do edital usando LLM
- **Analise de Incidencia**: Calcula frequencia de assuntos nas provas para direcionar estudos
- **Interface Visual**: Dashboard com visualizacao hierarquica e estatisticas

## Tech Stack

### Backend

| Tecnologia | Uso |
|------------|-----|
| Python 3.11+ | Linguagem principal |
| FastAPI | API REST |
| Groq (Llama 4 Scout) | LLM para classificacao |
| PyMuPDF | Extracao de PDFs |
| SQLite/PostgreSQL | Persistencia |

### Frontend

| Tecnologia | Uso |
|------------|-----|
| React 19 | Framework UI |
| TypeScript 5.7 | Tipagem |
| Vite | Build tool |
| TailwindCSS v4 | Estilizacao |
| Zustand | Gerenciamento de estado |

## Quick Start

### 1. Configurar Backend

```bash
# Criar ambiente virtual
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# Instalar dependencias
pip install uv
uv pip install -e .

# Configurar variaveis de ambiente
cp .env.example .env
# Editar .env com sua GROQ_API_KEY

# Iniciar API
uvicorn src.api.main:app --reload --port 8000
```

API disponivel em: http://localhost:8000/docs

### 2. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

Interface disponivel em: http://localhost:5173

## Estrutura do Projeto

```
analisador-questoes-concurso/
├── src/                    # Backend Python
│   ├── api/               # Rotas FastAPI
│   ├── extraction/        # Parsers de PDF (edital, provas)
│   ├── llm/               # Integracao com LLMs (Groq)
│   ├── classification/    # Pipeline de classificacao
│   ├── schemas/           # Modelos Pydantic
│   └── core/              # Config, logging, exceptions
├── frontend/              # Frontend React
│   ├── src/
│   │   ├── components/   # Componentes UI
│   │   ├── pages/        # Paginas (Home, EditalAnalysis)
│   │   ├── store/        # Estado Zustand
│   │   └── services/     # Cliente API
│   └── package.json
├── data/                  # Dados processados
│   ├── raw/              # PDFs originais
│   └── processed/        # JSONs extraidos
└── tests/                # Testes automatizados
```

## Como Usar

O workflow basico consiste em 3 etapas:

### 1. Upload do Edital

- Acesse a interface web
- Clique em "Novo Projeto"
- Faca upload do PDF do edital
- O sistema extrai automaticamente o conteudo programatico

### 2. Upload das Provas

- Com o projeto criado, faca upload dos PDFs das provas anteriores
- Formatos suportados: PCI Concursos (com gabarito inline), provas genericas
- O sistema extrai as questoes e seus gabaritos

### 3. Visualizar Analise

- Apos processamento, visualize a incidencia por assunto
- A arvore hierarquica mostra quantas questoes cairam em cada topico
- Use os dados para priorizar seus estudos

## Variaveis de Ambiente

```env
# Obrigatorio
GROQ_API_KEY=gsk_...

# Opcional (fallback)
ANTHROPIC_API_KEY=sk-ant-...

# Banco de dados
DATABASE_URL=sqlite:///./data/analisador.db
```

## Status do Projeto

O projeto esta em desenvolvimento ativo. Funcionalidades implementadas:

- [x] Extracao de editais com taxonomia hierarquica
- [x] Parser de provas formato PCI Concursos
- [x] Integracao com Groq/Llama 4 Scout
- [x] Interface web com upload de arquivos
- [x] Visualizacao de taxonomia extraida
- [ ] Classificacao automatica de questoes (em progresso)
- [ ] Dashboard de incidencia completo
- [ ] Exportacao de relatorios

## Licenca

MIT
