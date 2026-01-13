# Design: Analisador de Questões de Concursos

> Documento de design consolidado a partir de sessão de brainstorming em 2026-01-13

---

## 1. Visão Geral

### Propósito
Sistema para análise de incidência de assuntos em questões de concursos públicos brasileiros, utilizando LLMs para identificar padrões, similaridades, dificuldade e insights não óbvios que auxiliem estudantes na preparação.

### Diferencial
Não é apenas extração e listagem - é **análise profunda** com:
- Identificação de padrões temporais (evolução por ano)
- Detecção de questões similares/repetidas
- Classificação de dificuldade baseada em simulação (IRT)
- Análise de pegadinhas recorrentes
- Texto analítico com insights para o estudante

---

## 2. Arquitetura de Navegação

### Stack Frontend
- **React 19** + **Vite**
- **React Router** para navegação
- **Zustand** para estado global
- **TailwindCSS v4** para estilos
- **Ícones modernos** (sem emojis)

### Estrutura de Rotas

```
/                           → Home (Lista de Projetos)
/projeto/:id                → Projeto (redireciona para visão geral)
/projeto/:id/visao-geral    → Aba: Visão Geral
/projeto/:id/provas         → Aba: Provas & Questões
/projeto/:id/analise        → Aba: Análise Profunda
```

### Fluxo de Navegação

```
Home (Lista de Projetos)
    │
    ├─→ [Novo Projeto] → Wizard em etapas
    │       1. Upload do edital
    │       2. Seleção de cargo
    │       3. Extração de taxonomia + pesos
    │       4. Projeto criado → Redireciona para /projeto/:id
    │
    └─→ [Projeto existente] → Dentro do Projeto
            ├─→ Visão Geral (resumo + taxonomia + pesos)
            ├─→ Provas & Questões (uploads + árvore + lista)
            └─→ Análise Profunda (relatório + abas por disciplina)
```

---

## 3. Estrutura do Projeto

### Modelo de Dados

```
Projeto
├── id
├── nome
├── created_at
├── edital_id (FK)
├── cargo_selecionado
└── status: "ativo" | "arquivado"

Edital
├── id
├── nome_concurso
├── banca
├── ano
├── orgao
└── disciplinas[] (com pesos)

Disciplina (do edital)
├── id
├── edital_id (FK)
├── nome
├── num_questoes (ex: 20)
├── valor_questao (ex: 2.0)
├── total_pontos (ex: 40)
└── taxonomia (hierarquia de tópicos)

Prova
├── id
├── projeto_id (FK)
├── arquivo_nome
├── ano
├── cargo
├── status: "pending" | "processing" | "completed" | "partial" | "failed"
├── num_questoes_extraidas
├── confianca_media
└── erro_msg (se falhou)

Questao
├── id
├── prova_id (FK)
├── numero
├── enunciado
├── alternativas[]
├── gabarito
├── anulada: bool
├── disciplina
├── topico
├── subtopico
├── confianca_score (0-100)
├── dificuldade: "easy" | "medium" | "hard" | "very_hard"
├── bloom_level
├── tem_pegadinha: bool
└── embedding (vetor para similaridade)
```

### Três Áreas do Projeto

#### Aba 1: Visão Geral
- Resumo do projeto (nome, edital, cargo)
- Tabela de disciplinas com pesos:
  ```
  Disciplina    | Questões | Valor/Q | Total
  Português     | 20       | 2.0 pts | 40 pts
  Matemática    | 15       | 2.0 pts | 30 pts
  ...
  ```
- Estatísticas gerais (provas carregadas, questões extraídas)
- Taxonomia do edital em árvore colapsável

#### Aba 2: Provas & Questões
- Área de upload (drag & drop múltiplos PDFs)
- Fila de processamento com status individual
- Árvore de taxonomia com contagem de questões por tópico
- Clique em tópico → lista de questões no painel lateral
- Painel lateral com questão completa (enunciado, alternativas, gabarito)

#### Aba 3: Análise Profunda
- Botão "Gerar Análise" (só quando há questões)
- Barra de progresso durante geração
- Abas por disciplina (ordenadas por peso, maior primeiro)
- Cada aba contém:
  - Dashboard com métricas visuais
  - Texto analítico com insights da LLM
  - Lista de questões similares
  - Gráficos de incidência por tópico/ano

---

## 4. Camada de Robustez (Extração)

### 4.1 Validação Pré-Processamento

Antes de gastar tokens, validar cada PDF:
- Arquivo abre corretamente (não corrompido)
- Não é protegido por senha
- Tem texto extraível (não é scan/imagem pura)
- Texto tem tamanho mínimo (>1000 chars)

Se falhar: alertar usuário com motivo específico, não processar.

### 4.2 Fila com Status Individual

Estados possíveis por PDF:
- `pending` → Na fila, aguardando
- `validating` → Checando se é processável
- `processing` → Extraindo questões com LLM
- `completed` → Sucesso, questões salvas
- `partial` → Sucesso parcial, algumas com baixa confiança
- `failed` → Falhou, motivo registrado
- `retry` → Aguardando retry automático

**Regra:** Falha em um PDF nunca afeta os outros.

### 4.3 Score de Confiança por Questão

Critérios de scoring:
- +25% → Enunciado tem tamanho razoável (50-2000 chars)
- +25% → Tem exatamente 4-5 alternativas (A-E)
- +20% → Gabarito identificado claramente
- +15% → Classificada em disciplina do edital
- +15% → Formato consistente com outras do PDF

Resultado:
- 80-100% → Alta confiança (salva normal)
- 50-79% → Média confiança (salva com flag)
- <50% → Baixa confiança (salva + marca para revisão)

### 4.4 Retry e Fallback de API

```
Ao receber erro 429 (rate limit):

1. Ler header "Retry-After"
   → Se presente: esperar esse tempo
   → Se ausente: assumir 60 segundos

2. Se tempo > 5 minutos:
   → Tentar fallback: Claude Haiku 4.5
   → Se não disponível: pausar e notificar

3. Se limite DIÁRIO:
   → Pausar processamento
   → Notificar usuário
   → Oferecer opção de continuar com Claude (pago)

Cadeia de fallback:
Llama 4 Scout (Groq) → Claude Haiku 4.5 → Pausar
```

### 4.5 Checkpoint e Recuperação

Granularidade dos checkpoints:
- Após validação → PDF marcado como "válido"
- Após extração de texto → Texto bruto em cache
- Após extração de questões → Questões salvas (sem classificação)
- Após classificação → Completo

Se falhar no meio: retoma do último checkpoint, não recomeça.

### 4.6 Feedback Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PROCESSAMENTO DE PROVAS                                                │
│                                                                         │
│  Prova_2023.pdf     ████████████ 100%   ✓ 60 questões                 │
│  Prova_2022.pdf     ██████░░░░░░  50%   ⏳ Classificando...           │
│  Prova_2021.pdf     ░░░░░░░░░░░░   0%   ⏸ Na fila                     │
│  Prova_2020.pdf     ████████████ 100%   ⚠ 48 questões (3 revisar)     │
│  Prova_2019.pdf     ████████████ 100%   ✗ Falhou: PDF é imagem        │
│                                                                         │
│  Resumo: 3/5 completos │ 108 questões │ 3 para revisar │ 1 falhou      │
│                                                                         │
│  [Pausar]  [Cancelar]  [Reprocessar falhos]                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Pipeline de Análise Profunda

### Arquitetura: 4 Fases

Referência: `docs/ANALISE_PROFUNDA_ARQUITETURA.md`

```
Fase 1: Vetorização (determinística)
    - Embeddings com multilingual-e5-large
    - Clustering com HDBSCAN
    - Detecção de similaridade (k-NN)
    - Output: Relatório de Similaridade

Fase 2: Map (Llama 4 Scout via Groq)
    - Chunks de 15-25 questões por disciplina
    - Técnica "CoT then Formatting"
    - Output: Digests de cada chunk

Fase 3: Reduce + Multi-Pass (Claude Opus/Sonnet 4.5)
    - 5-7 passagens com temperature > 0
    - Votação majoritária para consolidar
    - Output: Relatório analítico

Fase 4: Chain-of-Verification (Claude Haiku 4.5)
    - Validação automática de afirmações
    - Busca evidências nas questões originais
    - Output: Relatório validado
```

### Custos Estimados

| Cenário | Custo |
|---------|-------|
| Por análise completa (4 disciplinas) | $0.17-0.31 |
| Mensal (100 análises) | $17-31 |

### Métricas de Qualidade

- Recall padrões óbvios: ~95%
- Recall padrões sutis: ~75-80%
- Similaridade (via embeddings): ~98%

---

## 6. Fluxo do Usuário

### Fluxo Completo

```
1. Home → "Novo Projeto"

2. Wizard:
   - Upload PDF do edital
   - Seleciona cargo
   - Sistema extrai taxonomia + pesos
   - Confirma → Projeto criado

3. Dentro do Projeto → Aba "Provas & Questões"
   - Arrasta 10 PDFs de provas
   - Sistema processa em fila
   - Acompanha progresso em tempo real
   - Revisa questões com baixa confiança (se houver)

4. Quando tiver material suficiente → Aba "Análise Profunda"
   - Clica "Gerar Análise Completa"
   - Aguarda 2-5 minutos
   - Relatório aparece em abas por disciplina

5. Consulta análise:
   - Navega entre disciplinas
   - Lê insights e padrões
   - Vê questões similares
   - Usa informações para direcionar estudo
```

---

## 7. Decisões de Design

| Decisão | Escolha | Alternativas Descartadas |
|---------|---------|--------------------------|
| Navegação | React Router + Zustand | SPA sem rotas |
| Criação de projeto | Wizard em etapas | Criação rápida + config depois |
| Áreas do projeto | 3 abas fixas | Visão única com seções |
| Output da análise | Dashboard híbrido (métricas + texto) | Só texto / Só gráficos |
| Abas por disciplina | Criadas na extração do edital | Criadas na análise |
| Visualização de questões | Lista compacta + painel lateral | Modal / Página dedicada |
| Upload de provas | Lote com fila + revisão assíncrona | Upload simples / Preview obrigatório |
| Validação de análise | Chain-of-Verification (CoVe) | Self-critique isolado (falha) |

---

## 8. Próximos Passos

### Prioridade 1: Camada de Robustez (Backend)
1. Implementar validação pré-processamento de PDF
2. Criar sistema de fila com estados
3. Adicionar score de confiança por questão
4. Implementar retry com backoff + fallback
5. Adicionar checkpoints por etapa

### Prioridade 2: Frontend Base
1. Configurar React Router
2. Criar layout base com navegação
3. Implementar página Home (lista de projetos)
4. Implementar wizard de criação de projeto
5. Criar estrutura das 3 abas

### Prioridade 3: Aba Provas & Questões
1. Área de upload com drag & drop
2. Fila de processamento com feedback visual
3. Árvore de taxonomia com contagem
4. Painel lateral para visualização de questões

### Prioridade 4: Análise Profunda
1. Implementar Fase 1 (vetorização/embeddings)
2. Implementar Fase 2 (Map com chunks)
3. Implementar Fase 3 (Reduce + Multi-Pass)
4. Implementar Fase 4 (CoVe)
5. UI da aba com abas por disciplina

---

*Design consolidado em 2026-01-13. Baseado em pesquisas de Google Deep Research e Claude Deep Research sobre limitações de LLMs e melhores práticas.*
