# Getting Started - Analisador de Questões de Concurso

Guia rápido para começar a usar o sistema.

## 1. Instalação

### Windows

```bash
# Execute o script de instalação
scripts\install.bat

# Ative o ambiente virtual
venv\Scripts\activate.bat
```

### Linux/Mac

```bash
# Dê permissão de execução
chmod +x scripts/install.sh

# Execute o script
./scripts/install.sh

# Ative o ambiente virtual
source venv/bin/activate
```

## 2. Configuração

Edite o arquivo `.env` e adicione suas API keys:

```env
# LLM APIs
GROQ_API_KEY=your_groq_api_key_here          # Groq (gratuito)
ANTHROPIC_API_KEY=your_claude_api_key_here   # Claude (opcional, para análise de imagens)
HUGGINGFACE_API_KEY=your_hf_token_here       # HuggingFace (opcional, fallback)

# Database (SQLite por padrão)
DATABASE_URL=sqlite+aiosqlite:///./data/questoes.db
```

## 3. Workflow Básico

### Passo 1: Extrair Questões de PDF

```bash
# Extrair questões de um PDF do PCI Concursos
analisador extract pdf data/raw/provas/fcc_analista_2024.pdf

# Ou processar múltiplos PDFs de uma vez
analisador extract batch data/raw/provas/
```

**Saída:** Arquivo JSON em `data/processed/questoes_extraidas/`

### Passo 2: Classificar Questões

```bash
# Classificar TODAS as questões de Português
analisador classify questions data/processed/questoes_extraidas/fcc_analista_2024.json \
    --disciplina "Português"

# Classificar TODAS as questões de Matemática
analisador classify questions data/processed/questoes_extraidas/fcc_analista_2024.json \
    --disciplina "Matemática"
```

**Saída:** Arquivo JSON com classificações hierárquicas (Disciplina → Assunto → Tópico → Subtópico → Conceito)

### Passo 3: Analisar Padrões e Similaridade

```bash
# Encontrar questões similares (usando embeddings semânticos)
analisador analyze similarity data/processed/questoes_extraidas/fcc_analista_2024_classificacoes.json \
    --threshold 0.75 \
    --top-k 20
```

**Saída:** Arquivo JSON com pares de questões similares

### Passo 4: Gerar Relatório Detalhado

```bash
# Gerar relatório ultra-detalhado para Português
analisador report generate data/processed/questoes_extraidas/fcc_analista_2024_classificacoes.json \
    --disciplina "Português"
```

**Saída:** Relatório em Markdown em `data/outputs/relatorios_md/`

## 4. Exemplo Completo

```bash
# 1. Baixe 15-20 PDFs de provas da mesma banca (ex: FCC) do site PCI Concursos
# 2. Coloque todos em data/raw/provas/

# 3. Extraia todas as questões
analisador extract batch data/raw/provas/

# 4. Classifique todas as questões de Português de todas as provas
for file in data/processed/questoes_extraidas/*.json; do
    analisador classify questions "$file" --disciplina "Português"
done

# 5. Combine todos os JSONs classificados em um só (manualmente ou com script)
# 6. Analise similaridade
analisador analyze similarity data/processed/todas_questoes_portugues_classificadas.json

# 7. Gere relatório final
analisador report generate data/processed/todas_questoes_portugues_classificadas.json \
    --disciplina "Português"
```

## 5. Usando a API (Opcional)

```bash
# Inicie o servidor
uvicorn src.api.main:app --reload

# Acesse a documentação interativa
# http://localhost:8000/docs
```

### Upload de PDF via API

```bash
curl -X POST "http://localhost:8000/api/upload/pdf" \
  -F "file=@data/raw/provas/fcc_2024.pdf"
```

## 6. Estrutura de Dados

### Questão Extraída (JSON)
```json
{
  "numero": 15,
  "disciplina": "Português",
  "assunto_pci": "Sintaxe",
  "enunciado": "...",
  "alternativas": {
    "A": "...",
    "B": "...",
    "C": "...",
    "D": "...",
    "E": "..."
  },
  "gabarito": "C",
  "anulada": false
}
```

### Classificação (JSON)
```json
{
  "disciplina": "Língua Portuguesa",
  "assunto": "Sintaxe",
  "topico": "Período Composto",
  "subtopico": "Orações Subordinadas Adverbiais",
  "conceito_especifico": "Orações concessivas com inversão sintática",
  "confianca_assunto": 0.95,
  "conceito_testado": "Esta questão testa a identificação de orações subordinadas adverbiais concessivas...",
  "habilidade_bloom": "analisar",
  "nivel_dificuldade": "avancado",
  "analise_alternativas": {
    "A": {"correta": false, "justificativa": "..."},
    "B": {"correta": true, "justificativa": "..."}
  }
}
```

## 7. Troubleshooting

### Erro: "Groq API key not configured"
Adicione `GROQ_API_KEY` no arquivo `.env`

### Erro: "Failed to load embedding model"
Primeira vez pode demorar para baixar o modelo (2-3 minutos)

### Erro: Database connection failed
Certifique-se de que executou `python scripts/setup_db.py`

## 8. Próximos Passos

- Explore os relatórios gerados em Markdown
- Ajuste thresholds de similaridade conforme necessário
- Combine análises de múltiplas provas para insights mais profundos
- Use os clusters de similaridade para identificar padrões da banca

## 9. Suporte

- Issues: https://github.com/yourusername/analisador-questoes-concurso/issues
- Documentação completa: `docs/`
