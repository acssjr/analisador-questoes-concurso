---
date: 2026-01-13T16:27:35-0300
session_name: analisador-questoes
researcher: Claude
git_commit: a00e110
branch: main
repository: analisador-questoes-concurso
topic: "Brainstorming de Design Completo - Análise Profunda de Questões"
tags: [brainstorming, design, frontend, backend, robustez, llm, analise-profunda]
status: complete
last_updated: 2026-01-13
last_updated_by: Claude
type: implementation_strategy
root_span_id:
turn_span_id:
---

# Handoff: Design Completo do Sistema de Análise de Questões

## Task(s)

1. **Brainstorming de Design** - COMPLETO
   - Sessão extensa de brainstorming definindo toda a arquitetura do sistema
   - Documentação completa do design em `docs/plans/2026-01-13-analisador-questoes-design.md`

2. **Pesquisa Aprofundada sobre LLMs** - COMPLETO
   - Google Deep Research + Claude Deep Research sobre limitações de LLMs
   - Arquitetura híbrida de 4 fases documentada em `docs/ANALISE_PROFUNDA_ARQUITETURA.md`

3. **Implementação** - NÃO INICIADA
   - Prioridade 1: Camada de Robustez (Backend)
   - Prioridade 2: Frontend Base com React Router
   - Prioridade 3: Aba Provas & Questões
   - Prioridade 4: Análise Profunda

## Critical References

- `docs/plans/2026-01-13-analisador-questoes-design.md` - Design completo do sistema
- `docs/ANALISE_PROFUNDA_ARQUITETURA.md` - Arquitetura do pipeline de análise com LLMs
- `thoughts/ledgers/CONTINUITY_CLAUDE-analisador-questoes.md` - Ledger de continuidade

## Recent changes

- `docs/plans/2026-01-13-analisador-questoes-design.md:1-280` - NOVO: Documento de design completo
- `docs/ANALISE_PROFUNDA_ARQUITETURA.md:1-320` - NOVO: Arquitetura de análise profunda

## Learnings

### Limitações de LLMs (Pesquisa Aprofundada)

1. **"Lost in the Middle"** - 80% das questões (posições 16-135 de 150) estão na zona de degradação de atenção. Processamento em chunk único perde até 30% dos padrões.

2. **JSON forçado degrada raciocínio em 10-15%** - Usar técnica "CoT then Formatting" (raciocinar em texto livre ANTES de estruturar JSON).

3. **Self-Critique isolado NÃO funciona** (MIT 2024) - Pode PIORAR resultados. Usar Chain-of-Verification (CoVe) com busca em dados externos.

4. **Multi-Pass com votação majoritária** - 5-7 passagens alcança 75-80% de recall em padrões sutis.

5. **Embeddings resolvem similaridade matematicamente** - Não depende de atenção da LLM. Usar multilingual-e5-large + HDBSCAN.

### Custos Claude API 2026

- Opus 4.5: $5/$25 por MTok (não mais Sonnet 3.5)
- Sonnet 4.5: $3/$15 por MTok
- Haiku 4.5: $1/$5 por MTok
- Batch API: 50% desconto
- Prompt Caching: 90% desconto em cache reads
- Custo por análise: $0.17-0.31

### Técnica Anti "Lost in the Middle" Validada

Ao reler as pesquisas em blocos menores, descobri 4 conceitos que havia perdido na primeira leitura:
- Monitoramento de drift vetorial
- Gatilhos específicos por banca (Cebraspe vs FGV)
- HDBSCAN para clustering
- CoVe como forma correta de self-critique

## Post-Mortem

### What Worked
- **Brainstorming estruturado**: Perguntas uma a uma com opções múltiplas funcionou bem
- **Pesquisa paralela**: Usar agente para buscar preços enquanto lia documentos
- **Releitura em blocos**: Aplicar a própria técnica da pesquisa para não perder informações
- **Self-critique da síntese**: Comparar primeira síntese vs. releitura mostrou ganho real

### What Failed
- Primeira síntese das pesquisas perdeu informações importantes (Lost in the Middle real)
- Inicialmente recomendei Self-Critique isolado, que a pesquisa mostra que falha

### Key Decisions
- **Arquitetura 4 fases**: Vetorização → Map → Reduce+Multi-Pass → CoVe
  - Alternativas: 3 fases, processamento único
  - Razão: Pesquisa mostra que combinar técnicas maximiza recall

- **Upload em lote com fila**: Processa PDFs independentemente com checkpoints
  - Alternativas: Upload simples, preview obrigatório
  - Razão: Robustez > conveniência, falha em um não afeta outros

- **React Router + Zustand**: Navegação com estado global
  - Alternativas: SPA sem rotas
  - Razão: Usuário reclamou que não conseguia navegar

- **Abas por disciplina criadas na extração**: Não na análise
  - Alternativas: Criar dinâmicamente
  - Razão: Já temos disciplinas + pesos do edital

## Artifacts

### Documentos de Design
- `docs/plans/2026-01-13-analisador-questoes-design.md` - Design completo
- `docs/ANALISE_PROFUNDA_ARQUITETURA.md` - Arquitetura de análise

### Pesquisas (Downloads do usuário)
- `C:\Users\antonio.santos\Downloads\Análise de Padrões em Concursos com LLMs.md` - Google Deep Research
- `C:\Users\antonio.santos\Downloads\compass_artifact_wf-62508ca9-d368-4604-9b89-232db6a0040a_text_markdown.md` - Claude Deep Research

## Action Items & Next Steps

### Prioridade 1: Camada de Robustez (Backend)
1. Implementar validação pré-processamento de PDF
2. Criar sistema de fila com estados (pending, processing, completed, failed, etc.)
3. Adicionar score de confiança por questão (0-100%)
4. Implementar retry com backoff + fallback (Groq → Haiku)
5. Adicionar checkpoints por etapa (validação → extração → classificação)

### Prioridade 2: Frontend Base
1. Configurar React Router com rotas definidas
2. Criar layout base com navegação
3. Implementar página Home (lista de projetos)
4. Implementar wizard de criação de projeto
5. Criar estrutura das 3 abas (Visão Geral, Provas & Questões, Análise)

### Prioridade 3: Aba Provas & Questões
1. Área de upload com drag & drop múltiplos PDFs
2. Fila de processamento com feedback visual
3. Árvore de taxonomia com contagem de questões
4. Painel lateral para visualização de questões

### Prioridade 4: Análise Profunda
1. Implementar Fase 1 (vetorização com embeddings)
2. Implementar Fase 2 (Map com chunks de 15-25 questões)
3. Implementar Fase 3 (Reduce + Multi-Pass com votação)
4. Implementar Fase 4 (Chain-of-Verification)
5. UI da aba com abas por disciplina

## Other Notes

### Decisões do Brainstorming

| Tópico | Decisão |
|--------|---------|
| Navegação | Home → Projetos → Dentro do Projeto |
| Criação de projeto | Wizard em etapas |
| Áreas do projeto | 3 abas (Visão Geral, Provas & Questões, Análise) |
| Output da análise | Dashboard híbrido (métricas + texto) |
| Abas por disciplina | Ordenadas por peso, criadas na extração |
| Visualização de questões | Lista compacta + painel lateral |
| Roteamento | React Router + Zustand |
| Upload de provas | Lote com fila + robustez completa |
| Garantia de qualidade | Multi-Pass + CoVe |
| Pesos das disciplinas | Questões × Valor (extraído automaticamente do edital) |

### Arquitetura de Robustez (Upload)

```
Estados por PDF: pending → validating → processing → completed/partial/failed
Retry: Ler Retry-After header, fallback para Haiku se > 5min
Checkpoints: Após validação, extração de texto, extração de questões, classificação
Score de confiança: 5 critérios (tamanho, alternativas, gabarito, disciplina, formato)
```

### Pipeline de Análise Profunda

```
Fase 1: Vetorização (embeddings multilingual-e5-large + HDBSCAN)
Fase 2: Map (Llama 4 Scout, chunks 15-25, CoT then Formatting)
Fase 3: Reduce + Multi-Pass (Claude, 5-7 passagens, votação majoritária)
Fase 4: CoVe (validação automática com busca em dados originais)
```

### Servidores de Desenvolvimento
- Backend: `http://localhost:8000` (FastAPI)
- Frontend: `http://localhost:5176` (Vite - porta pode variar)
