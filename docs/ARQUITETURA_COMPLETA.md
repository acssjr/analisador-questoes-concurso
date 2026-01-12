# Analisador de Questões de Concurso - Documentação Completa

## Sumário Executivo

Este sistema é uma plataforma de análise inteligente de questões de concursos públicos brasileiros. Utiliza IA (LLMs) para extrair, classificar e analisar questões de provas, comparando-as com o conteúdo programático oficial do edital.

### Objetivo Principal
Permitir que candidatos a concursos públicos:
1. Entendam quais tópicos são mais cobrados (análise de incidência)
2. Identifiquem padrões de questões similares (análise de similaridade)
3. Classifiquem questões hierarquicamente segundo a taxonomia do edital
4. Gerem relatórios de estudo personalizados

---

## 1. Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────────────────┐  │
│  │Insights │  │Laborat. │  │ Edital  │  │ EditalWorkflowModal   │  │
│  │  Page   │  │  Page   │  │Analysis │  │ (Upload + Extração)   │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └───────────┬───────────┘  │
│       │            │            │                    │              │
│       └────────────┴────────────┴────────────────────┘              │
│                              │                                       │
│                    ┌─────────┴─────────┐                            │
│                    │   Zustand Store   │                            │
│                    │   (Estado Global) │                            │
│                    └─────────┬─────────┘                            │
│                              │                                       │
│                    ┌─────────┴─────────┐                            │
│                    │   API Service     │                            │
│                    │   (fetch calls)   │                            │
│                    └─────────┬─────────┘                            │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ HTTP/REST
┌──────────────────────────────┼──────────────────────────────────────┐
│                         BACKEND (FastAPI)                           │
│                              │                                       │
│  ┌───────────────────────────┴───────────────────────────────┐     │
│  │                      API Routes                            │     │
│  │  /editais  /upload  /questoes  /analise  /classificacao   │     │
│  └───────────────────────────┬───────────────────────────────┘     │
│                              │                                       │
│  ┌───────────┬───────────────┼───────────────┬───────────────┐     │
│  │           │               │               │               │     │
│  ▼           ▼               ▼               ▼               ▼     │
│┌─────────┐┌──────────┐┌───────────┐┌──────────┐┌────────────┐      │
││Extraction││Classific.││ Similarity ││Embeddings││   LLM      │      │
││  Module  ││  Module  ││   Module   ││  Module  ││Orchestrator│      │
│└────┬────┘└────┬─────┘└─────┬─────┘└────┬─────┘└──────┬─────┘      │
│     │          │            │           │             │             │
│     └──────────┴────────────┴───────────┴─────────────┘             │
│                              │                                       │
│                    ┌─────────┴─────────┐                            │
│                    │     Database      │                            │
│                    │   (SQLite/Async)  │                            │
│                    └───────────────────┘                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Conceito de Taxonomia

### O que é a Taxonomia?
A taxonomia é a estrutura hierárquica do conteúdo programático do edital, organizada em 4-5 níveis:

```
DISCIPLINA
└── ASSUNTO
    └── TÓPICO
        └── SUBTÓPICO
            └── CONCEITO ESPECÍFICO
```

### Exemplo Real:
```
Língua Portuguesa
├── Sintaxe
│   ├── Período Composto
│   │   ├── Orações Subordinadas Substantivas
│   │   ├── Orações Subordinadas Adjetivas
│   │   └── Orações Subordinadas Adverbiais
│   └── Concordância
│       ├── Concordância Verbal
│       └── Concordância Nominal
└── Morfologia
    └── Classes de Palavras
        ├── Substantivo
        ├── Verbo
        └── Advérbio

Legislação Básica
├── Legislação Federal
│   ├── Constituição Federal de 1988
│   │   ├── Dos Princípios Fundamentais
│   │   ├── Dos Direitos e Garantias Fundamentais
│   │   └── Art. 37 - Princípios da Administração Pública
│   ├── Lei Federal nº 8.429/1992 - Improbidade Administrativa
│   ├── Lei Federal nº 9.784/1999 - Processo Administrativo
│   └── Lei Federal nº 13.709/2018 - LGPD
└── Legislação Estadual
    ├── Lei nº 6.677/1994 - Estatuto dos Servidores
    └── Lei nº 12.209/2011 - Processo Administrativo BA
```

### Por que a Taxonomia é Crítica?
1. **Classificação Precisa**: Cada questão é mapeada para um item EXATO do edital
2. **Análise de Incidência**: Permite calcular % de questões por tópico
3. **Identificação de Gaps**: Mostra quais tópicos nunca foram cobrados
4. **Direcionamento de Estudo**: Prioriza tópicos mais frequentes

---

## 3. Estrutura do Projeto

### 3.1 Diretórios Backend (`src/`)

```
src/
├── api/                    # API REST (FastAPI)
│   ├── main.py            # Ponto de entrada da API
│   └── routes/            # Endpoints organizados por domínio
│       ├── editais.py     # Upload e gestão de editais
│       ├── upload.py      # Upload de PDFs de provas
│       ├── questoes.py    # CRUD de questões
│       ├── classificacao.py# Classificação via LLM
│       ├── analise.py     # Análise de incidência/similaridade
│       ├── provas.py      # Gestão de provas
│       └── relatorios.py  # Geração de relatórios
│
├── core/                   # Configurações centrais
│   ├── config.py          # Settings (env vars, paths)
│   ├── database.py        # Conexão SQLite async
│   ├── exceptions.py      # Exceções customizadas
│   └── logging.py         # Configuração de logs
│
├── models/                 # Modelos SQLAlchemy (ORM)
│   ├── edital.py          # Modelo Edital
│   ├── prova.py           # Modelo Prova
│   ├── questao.py         # Modelo Questao
│   ├── classificacao.py   # Modelo Classificacao
│   ├── cluster.py         # Modelo Cluster (similaridade)
│   ├── embedding.py       # Modelo Embedding
│   └── relatorio.py       # Modelo Relatorio
│
├── schemas/                # Schemas Pydantic (validação)
│   ├── edital.py          # EditalUploadResponse, etc
│   ├── prova.py           # ProvaSchema
│   ├── questao.py         # QuestaoSchema
│   └── classificacao.py   # ClassificacaoSchema
│
├── extraction/             # Extração de dados de PDFs
│   ├── edital_extractor.py # Extrai metadata e taxonomia
│   ├── pci_parser.py      # Parser de provas PCI Concursos
│   ├── pdf_detector.py    # Detecta formato do PDF
│   └── image_extractor.py # Extrai imagens de questões
│
├── llm/                    # Integração com LLMs
│   ├── llm_orchestrator.py # Orquestrador multi-provider
│   ├── providers/
│   │   ├── groq_client.py  # Cliente Groq (Llama)
│   │   └── anthropic_client.py # Cliente Claude
│   └── prompts/
│       └── classificacao.py # Prompts de classificação
│
├── classification/         # Lógica de classificação
│   └── classifier.py      # QuestionClassifier
│
├── analysis/               # Análise de dados
│   ├── embeddings.py      # Geração de embeddings
│   └── similarity.py      # Cálculo de similaridade
│
├── optimization/           # Otimização de tokens
│   └── token_utils.py     # Pruning e estimativa
│
├── report/                 # Geração de relatórios
│   └── report_generator.py # Gerador de relatórios
│
└── cli/                    # Interface de linha de comando
    ├── main.py            # CLI principal
    └── commands/          # Comandos CLI
        ├── extract.py     # Comando de extração
        ├── classify.py    # Comando de classificação
        ├── analyze.py     # Comando de análise
        └── report.py      # Comando de relatório
```

### 3.2 Diretórios Frontend (`frontend/src/`)

```
frontend/src/
├── main.tsx               # Entrada React
├── App.tsx                # Componente raiz + Router
│
├── pages/                 # Páginas da aplicação
│   ├── Insights.tsx       # Dashboard principal
│   ├── Laboratory.tsx     # Análises avançadas
│   └── EditalAnalysis.tsx # Análise por edital
│
├── components/
│   ├── layout/            # Componentes de layout
│   │   ├── MainLayout.tsx # Layout principal
│   │   ├── Sidebar.tsx    # Menu lateral
│   │   └── Topbar.tsx     # Barra superior
│   │
│   ├── ui/                # Componentes de UI
│   │   ├── Button.tsx     # Botões
│   │   ├── Badge.tsx      # Badges
│   │   ├── Card.tsx       # Cards
│   │   └── Modal.tsx      # Modais
│   │
│   ├── charts/            # Gráficos
│   │   ├── TreemapChart.tsx    # Treemap de incidência
│   │   └── TimelineChart.tsx   # Timeline temporal
│   │
│   └── features/          # Componentes de features
│       ├── EditalWorkflowModal.tsx # Wizard de upload
│       ├── UploadModal.tsx        # Upload simples
│       ├── AnalysisPanel.tsx      # Painel de análise
│       └── NotificationCenter.tsx # Notificações
│
├── store/                 # Estado global (Zustand)
│   └── appStore.ts        # Store principal
│
├── services/              # Comunicação com API
│   └── api.ts             # Cliente HTTP
│
├── hooks/                 # React Hooks customizados
│   └── useNotifications.tsx
│
└── types/                 # TypeScript types
    └── index.ts           # Todos os tipos
```

---

## 4. Fluxo de Dados Completo

### 4.1 Fluxo de Upload e Extração

```
┌────────────────────────────────────────────────────────────────┐
│                    FLUXO DE UPLOAD                              │
└────────────────────────────────────────────────────────────────┘

1. UPLOAD DO EDITAL (PDF)
   User → EditalWorkflowModal → api.uploadEdital()
                                      │
                                      ▼
   Backend: POST /api/editais/upload
   ┌─────────────────────────────────────────────┐
   │ 1. Salva PDF em data/raw/editais/           │
   │ 2. Extrai texto (PyMuPDF - max 15 páginas)  │
   │ 3. LLM extrai metadata:                     │
   │    - nome: "Concurso TRF 5ª Região 2024"    │
   │    - banca: "CESPE/CEBRASPE"                │
   │    - cargos: ["Analista", "Técnico"]        │
   │    - ano: 2024                              │
   │    - disciplinas: ["Português", "Direito"]  │
   │ 4. Salva no banco (tabela editais)          │
   │ 5. Retorna EditalUploadResponse             │
   └─────────────────────────────────────────────┘

2. SELEÇÃO DE CARGO (se múltiplos)
   User seleciona cargo específico no dropdown

3. UPLOAD DO CONTEÚDO PROGRAMÁTICO (PDF)
   User → EditalWorkflowModal → api.uploadConteudoProgramatico(cargo)
                                      │
                                      ▼
   Backend: POST /api/editais/{id}/conteudo-programatico?cargo=X
   ┌─────────────────────────────────────────────┐
   │ 1. Salva PDF em data/raw/editais/{id}/      │
   │ 2. Extrai texto (max 50 páginas)            │
   │ 3. LLM extrai taxonomia COMPLETA:           │
   │    - Disciplinas                            │
   │    - Assuntos                               │
   │    - Tópicos                                │
   │    - Subtópicos (CADA lei, artigo, etc)     │
   │ 4. Atualiza edital.taxonomia no banco       │
   │ 5. Retorna ConteudoProgramaticoResponse     │
   └─────────────────────────────────────────────┘

4. UPLOAD DAS PROVAS (PDFs)
   User → EditalWorkflowModal → api.uploadProvasVinculadas()
                                      │
                                      ▼
   Backend: POST /api/upload/pdf?edital_id=X
   ┌─────────────────────────────────────────────┐
   │ Para cada PDF:                              │
   │ 1. Detecta formato (PCI, Gabarito, etc)     │
   │ 2. Extrai questões (parser específico)      │
   │ 3. Retorna questões extraídas               │
   └─────────────────────────────────────────────┘
```

### 4.2 Fluxo de Classificação

```
┌────────────────────────────────────────────────────────────────┐
│                    FLUXO DE CLASSIFICAÇÃO                       │
└────────────────────────────────────────────────────────────────┘

Questão + Taxonomia → QuestionClassifier
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Token Optimization                                        │
│    - prune_questao(): Remove espaços, normaliza             │
│    - Reduz tokens de entrada                                │
│                                                              │
│ 2. Build Classification Prompt                               │
│    - Inclui enunciado + alternativas + gabarito             │
│    - Inclui taxonomia formatada (se disponível)             │
│    - Instruções detalhadas para classificação               │
│                                                              │
│ 3. LLM Call (Groq/Claude)                                   │
│    - System prompt: especialista em concursos               │
│    - Temperature: 0.1 (determinístico)                      │
│    - Max tokens: 512 (JSON compacto)                        │
│                                                              │
│ 4. Parse Response                                            │
│    - Extrai JSON da resposta                                │
│    - Valida campos obrigatórios                             │
│                                                              │
│ 5. Retorna Classificação:                                    │
│    {                                                         │
│      "disciplina": "Língua Portuguesa",                     │
│      "assunto": "Sintaxe",                                  │
│      "topico": "Período Composto",                          │
│      "subtopico": "Orações Subordinadas",                   │
│      "conceito_especifico": "Orações adverbiais causais",   │
│      "item_edital_path": "Port > Sint > Per.Comp > Or.Sub", │
│      "confianca_disciplina": 0.95,                          │
│      "confianca_assunto": 0.88,                             │
│      "habilidade_bloom": "aplicar",                         │
│      "nivel_dificuldade": "intermediario",                  │
│      "analise_alternativas": {...}                          │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Fluxo de Similaridade

```
┌────────────────────────────────────────────────────────────────┐
│                    FLUXO DE SIMILARIDADE                        │
└────────────────────────────────────────────────────────────────┘

Questões → EmbeddingGenerator → Similarity Module
                │                       │
                ▼                       ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│ 1. Gera Embeddings      │  │ 3. Calcula Similaridade │
│    - Modelo: mpnet      │  │    - Cosine similarity  │
│    - Dimensão: 768      │  │    - Threshold: 0.75    │
│    - Batch processing   │  │    - Matriz NxN         │
└─────────────────────────┘  └─────────────────────────┘
                │                       │
                ▼                       ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│ 2. Armazena Embeddings  │  │ 4. Identifica Pares     │
│    - Banco de dados     │  │    - Questões similares │
│    - Cache para reuso   │  │    - Clusters temáticos │
└─────────────────────────┘  └─────────────────────────┘
```

---

## 5. Módulos Detalhados

### 5.1 Extraction Module

**Arquivo**: `src/extraction/edital_extractor.py`

#### Funções:

```python
extract_edital_text(pdf_path, max_pages=10) -> str
    """Extrai texto bruto do PDF usando PyMuPDF"""

extract_edital_metadata(pdf_path) -> dict
    """
    Usa LLM para extrair:
    - nome: Nome do concurso
    - banca: Organizadora
    - cargos: Lista de cargos (separa "X e Y" em lista)
    - ano: Ano do concurso
    - disciplinas: Lista de disciplinas
    """

extract_conteudo_programatico(pdf_path, cargo=None) -> dict
    """
    Usa LLM para extrair taxonomia COMPLETA:
    - Disciplinas
    - Assuntos
    - Tópicos
    - Subtópicos (CADA lei, artigo individualmente)

    Se cargo especificado, filtra apenas para aquele cargo.
    """
```

#### Prompt de Extração de Taxonomia:
```
TAREFA CRÍTICA:
NÃO RESUMA. NÃO ABREVIE. Extraia CADA ITEM INDIVIDUAL.

REGRAS OBRIGATÓRIAS:
1. EXTRAIA CADA LEI INDIVIDUALMENTE com número completo
   (ex: "Lei Federal nº 8.429/1992")
2. EXTRAIA CADA ARTIGO mencionado
   (ex: "Art. 37 da Constituição Federal")
3. EXTRAIA CADA ITEM numerado como subtópico separado
4. NÃO agrupe itens
5. Use os NOMES EXATOS do edital
```

### 5.2 Classification Module

**Arquivo**: `src/classification/classifier.py`

```python
class QuestionClassifier:
    def classify_question(questao, edital_taxonomia=None) -> dict:
        """
        Classifica uma questão na taxonomia do edital.

        Retorna:
        - disciplina, assunto, topico, subtopico
        - conceito_especifico
        - item_edital_path (caminho na hierarquia)
        - confianca_* (scores de confiança)
        - habilidade_bloom (taxonomia de Bloom)
        - nivel_dificuldade
        - analise_alternativas
        """

    def classify_batch(questoes, edital_taxonomia=None) -> list:
        """Classifica múltiplas questões com throttling"""
```

### 5.3 Similarity Module

**Arquivo**: `src/analysis/similarity.py`

```python
calculate_cosine_similarity(emb1, emb2) -> float
    """Calcula similaridade cosseno entre dois embeddings"""

find_similar_questions(target_emb, all_embs, threshold=0.75) -> list
    """Encontra questões similares a uma questão alvo"""

find_most_similar_pairs(embeddings, ids, threshold=0.75) -> list
    """Encontra pares de questões mais similares no dataset"""

calculate_similarity_matrix(embeddings) -> np.ndarray
    """Calcula matriz de similaridade NxN"""
```

### 5.4 LLM Orchestrator

**Arquivo**: `src/llm/llm_orchestrator.py`

```python
class LLMOrchestrator:
    """
    Orquestra chamadas a múltiplos provedores de LLM.

    Provedores suportados:
    - Groq (default): Llama 3.3 70B - rápido e gratuito
    - Anthropic: Claude 3.5 Sonnet - mais preciso

    Features:
    - Fallback automático entre provedores
    - Retry com backoff exponencial
    - Rate limiting
    """

    def generate(prompt, system_prompt, temperature, max_tokens) -> dict:
        """
        Gera resposta usando LLM.

        Retorna:
        - content: Texto da resposta
        - provider: Provider usado
        - model: Modelo usado
        - tokens: Contagem de tokens
        """
```

---

## 6. Banco de Dados

### 6.1 Schema

```sql
-- Editais (concursos)
CREATE TABLE editais (
    id UUID PRIMARY KEY,
    nome VARCHAR NOT NULL,
    banca VARCHAR,
    cargo VARCHAR,
    ano INTEGER,
    arquivo_original VARCHAR,
    taxonomia JSON,  -- Estrutura hierárquica completa
    created_at TIMESTAMP
);

-- Provas
CREATE TABLE provas (
    id UUID PRIMARY KEY,
    edital_id UUID REFERENCES editais(id),
    nome VARCHAR,
    ano INTEGER,
    arquivo_original VARCHAR,
    total_questoes INTEGER,
    created_at TIMESTAMP
);

-- Questões
CREATE TABLE questoes (
    id UUID PRIMARY KEY,
    prova_id UUID REFERENCES provas(id),
    numero INTEGER,
    enunciado TEXT,
    alternativas JSON,  -- {"A": "...", "B": "...", ...}
    gabarito CHAR(1),
    anulada BOOLEAN,
    imagens JSON,  -- Lista de paths de imagens
    created_at TIMESTAMP
);

-- Classificações
CREATE TABLE classificacoes (
    id UUID PRIMARY KEY,
    questao_id UUID REFERENCES questoes(id),
    disciplina VARCHAR,
    assunto VARCHAR,
    topico VARCHAR,
    subtopico VARCHAR,
    conceito_especifico VARCHAR,
    item_edital_path VARCHAR,
    confianca_disciplina FLOAT,
    confianca_assunto FLOAT,
    habilidade_bloom VARCHAR,
    nivel_dificuldade VARCHAR,
    raw_response JSON,
    created_at TIMESTAMP
);

-- Embeddings
CREATE TABLE embeddings (
    id UUID PRIMARY KEY,
    questao_id UUID REFERENCES questoes(id),
    tipo VARCHAR,  -- 'enunciado', 'completo', 'resposta'
    vector BLOB,  -- Embedding serializado
    created_at TIMESTAMP
);

-- Clusters (similaridade)
CREATE TABLE clusters (
    id UUID PRIMARY KEY,
    edital_id UUID,
    conceito_comum VARCHAR,
    avg_similaridade FLOAT,
    created_at TIMESTAMP
);

CREATE TABLE cluster_questoes (
    cluster_id UUID REFERENCES clusters(id),
    questao_id UUID REFERENCES questoes(id),
    PRIMARY KEY (cluster_id, questao_id)
);
```

---

## 7. API Endpoints

### 7.1 Editais

```
POST /api/editais/upload
    Body: multipart/form-data (file)
    Response: EditalUploadResponse

POST /api/editais/{id}/conteudo-programatico?cargo=X
    Body: multipart/form-data (file)
    Response: ConteudoProgramaticoResponse

GET /api/editais
    Response: List[EditalRead]

GET /api/editais/{id}
    Response: EditalRead
```

### 7.2 Upload de Provas

```
POST /api/upload/pdf?edital_id=X
    Body: multipart/form-data (files[])
    Response: {
        success: bool,
        total_files: int,
        successful_files: int,
        failed_files: int,
        total_questoes: int,
        results: [...]
    }
```

### 7.3 Questões

```
GET /api/questoes?dataset_id=X&disciplina=Y
    Response: List[Questao]

GET /api/questoes/{id}
    Response: QuestaoCompleta

GET /api/questoes/{id}/analise
    Response: QuestaoCompleta (com classificação)

GET /api/questoes/similares?dataset_id=X&disciplina=Y&threshold=0.75
    Response: List[QuestaoSimilar]
```

### 7.4 Dashboard

```
GET /api/dashboard/stats?dataset_id=X&disciplina=Y
    Response: {
        total_questoes: int,
        total_regulares: int,
        total_anuladas: int,
        disciplinas: {nome: count},
        assuntos_top: [{assunto, count, percentual}],
        anos: [{ano, count}]
    }
```

---

## 8. Frontend Components

### 8.1 EditalWorkflowModal

**Arquivo**: `frontend/src/components/features/EditalWorkflowModal.tsx`

Wizard de 3 etapas para importação completa:

```
Etapa 1: Upload do Edital
├── Upload automático com extração
├── Preview de informações extraídas
├── Seleção de cargo (se múltiplos)
└── Validação antes de prosseguir

Etapa 2: Upload do Conteúdo Programático
├── Upload com filtro por cargo
├── Preview da taxonomia extraída
├── Contadores (disciplinas, assuntos, tópicos)
└── Expansão hierárquica para visualização

Etapa 3: Upload das Provas
├── Multi-file upload
├── Extração automática de questões
├── Preview de resultados por arquivo
└── Finalização e salvamento
```

### 8.2 Estado Global (Zustand)

**Arquivo**: `frontend/src/store/appStore.ts`

```typescript
interface AppState {
    // Dados
    editais: Edital[];
    currentEdital: EditalComAnalise | null;
    questoes: Questao[];

    // UI
    modoCanvas: 'insights' | 'laboratorio';
    filtrosGlobais: FiltrosGlobais;

    // Actions
    setEditais(editais: Edital[]): void;
    setCurrentEdital(edital: EditalComAnalise): void;
    addEdital(edital: Edital): void;
    // ...
}
```

---

## 9. Configuração

### 9.1 Variáveis de Ambiente

```env
# Ambiente
ENV=development
DEBUG=true
LOG_LEVEL=INFO

# Banco de Dados
DATABASE_URL=sqlite+aiosqlite:///./data/questoes.db

# LLM APIs
GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=sk-ant-...

# LLM Settings
DEFAULT_LLM_PROVIDER=groq
DEFAULT_TEXT_MODEL=llama-3.3-70b-versatile
DEFAULT_VISION_MODEL=claude-3-5-sonnet-20241022
LLM_TEMPERATURE=0.1

# Embeddings
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-mpnet-base-v2

# Clustering
SIMILARITY_THRESHOLD=0.75
MIN_CLUSTER_SIZE=2
```

---

## 10. Fluxo de Análise de Incidência

A análise de incidência calcula a frequência de cada tópico nas questões:

```
1. Carrega todas as questões do edital
2. Para cada questão com classificação:
   - Obtém disciplina, assunto, tópico
   - Incrementa contador na hierarquia
3. Calcula percentuais:
   - % de questões por disciplina
   - % de questões por assunto (dentro da disciplina)
   - % de questões por tópico
4. Gera árvore de incidência (IncidenciaNode[])
5. Renderiza como Treemap no frontend
```

### Estrutura IncidenciaNode:

```typescript
interface IncidenciaNode {
    nome: string;           // Nome do item (disciplina/assunto/tópico)
    count: number;          // Número de questões
    percentual: number;     // % do total
    children?: IncidenciaNode[];  // Filhos na hierarquia
    questoes?: Questao[];   // Questões classificadas neste item
    confianca_media?: number;  // Média de confiança
}
```

---

## 11. Considerações Técnicas

### 11.1 Otimização de Tokens

O sistema implementa várias estratégias para reduzir custos com LLM:

1. **Pruning de Questões**: Remove espaços extras, normaliza texto
2. **Output Control**: Limita max_tokens da resposta
3. **Batch Processing**: Processa questões em lote com throttling
4. **Cache de Embeddings**: Reutiliza embeddings já calculados

### 11.2 Resiliência

1. **Retry com Backoff**: Tentativas automáticas em falhas
2. **Fallback de Providers**: Troca de LLM se um falhar
3. **Validação de Resposta**: Verifica JSON válido antes de usar

### 11.3 Escalabilidade

1. **Async/Await**: API assíncrona para I/O não bloqueante
2. **Batch Processing**: Processamento em lotes configurável
3. **SQLite → PostgreSQL**: Fácil migração para produção

---

## 12. Próximos Passos Sugeridos

1. **Implementar análise temporal**: Evolução de tópicos ao longo dos anos
2. **Adicionar predição**: Prever tópicos prováveis para próxima prova
3. **Exportar relatórios**: PDF/Excel com análise completa
4. **Implementar flashcards**: Gerar cards de estudo por tópico
5. **Adicionar gamificação**: Progresso e conquistas do usuário

---

*Documento gerado em: 2026-01-12*
*Versão: 1.0*
