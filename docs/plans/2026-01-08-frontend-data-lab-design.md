# Frontend Design - Data Lab Interface
**Data**: 2026-01-08
**Projeto**: Analisador de Questões de Concurso
**Metáfora**: Laboratório de Dados / Científico

---

## 1. Visão Geral

### Objetivo
Criar uma interface inovadora que fuja de dashboards corporativos convencionais, adotando a metáfora de um laboratório científico de análise de dados. O usuário (concurseiro) deve sentir que está fazendo análise forense de questões, não apenas visualizando estatísticas superficiais.

### Princípios de Design
- **Profundidade sobre Amplitude**: Foco em análise detalhada de UMA disciplina por vez
- **Descoberta Progressiva**: Modo Insights (automático) → Modo Laboratório (exploração avançada)
- **Precisão Científica**: Linguagem visual técnica, não corporativa
- **Fluidez**: SPA com transições suaves, zero page reloads

---

## 2. Arquitetura Geral

### Layout de 3 Painéis

```
┌─────────────────────────────────────────────────────────────┐
│  BARRA SUPERIOR (fixa, 64px)                                │
├─────────┬───────────────────────────────────┬───────────────┤
│         │                                   │               │
│ SIDEBAR │        CANVAS CENTRAL             │ PAINEL        │
│ (240px) │         (flexível)                │ DIREITO       │
│         │                                   │ (360px,       │
│ Lista   │  Modo Insights OU Modo Lab        │ colapsável)   │
│ de      │                                   │               │
│ Disci-  │  Cards / Gráficos / Tabelas       │ Análise       │
│ plinas  │                                   │ de Questão    │
│         │                                   │               │
└─────────┴───────────────────────────────────┴───────────────┘
```

### Componentes Principais
- **Barra Superior**: Contexto global, filtros rápidos, ações principais
- **Sidebar Esquerda**: Navegação por disciplina
- **Canvas Central**: Área de trabalho principal (Insights ou Laboratório)
- **Painel Direito**: Análise profunda de questão selecionada (colapsável)

---

## 3. Sidebar - Navegação por Disciplina

### Estrutura
- Header: "Disciplinas" + contador total de questões
- Lista de disciplinas encontradas no dataset ativo
- Cada item mostra:
  - Nome da disciplina
  - Badge colorido com número de questões
  - Indicador visual de disciplina ativa

### Comportamento
- Click em disciplina → filtra todo o conteúdo do canvas central
- Disciplina ativa recebe destaque visual (border-left colorida + bg levemente destacado)
- Ordem alfabética ou por quantidade de questões (configurável)

### Visual
- Fundo: cinza escuro (#161b22)
- Items: padding 12px, hover com bg (#ffffff05)
- Badges: cores únicas por disciplina (paleta de 12 cores)

---

## 4. Canvas Central - Modo Insights

### Propósito
Visão automática e inteligente da disciplina selecionada. O sistema apresenta insights prontos sem exigir configuração do usuário.

### Seções (ordem vertical, scroll)

#### 4.1 Overview Cards (topo, 3 colunas)
1. **Total de Questões**
   - Número grande centralizado
   - Breakdown: Regulares vs Anuladas
   - Gráfico de linha micro mostrando distribuição temporal

2. **Distribuição por Assunto**
   - Mini treemap ou donut chart
   - Top 3 assuntos mais cobrados com %

3. **Nível de Cobertura do Edital**
   - Percentual de tópicos do edital que foram cobrados
   - Indicador visual (progress ring)

#### 4.2 Alertas Críticos
- Cards destacados (border amarela) para:
  - "5 questões anuladas em Sintaxe - possível padrão de erro da banca"
  - "Tópico X cobrado 15 vezes mas nunca em nível avançado"
- Ação: Click expande detalhes ou navega para Laboratório com filtro aplicado

#### 4.3 Questões Similares (Clusters Automáticos)
- Grid de cards (2-3 por linha)
- Cada card representa um cluster de questões similares:
  - Título: conceito comum detectado
  - Exemplo: "Orações subordinadas adverbiais concessivas - 8 questões"
  - Preview de 2 enunciados mais representativos
  - % de similaridade média
- Click em card → abre painel direito com lista completa do cluster

#### 4.4 Linha do Tempo
- Eixo horizontal com anos
- Barras empilhadas mostrando quantidade de questões por assunto ao longo do tempo
- Detecta tendências: "Regência verbal cresceu 40% nos últimos 3 anos"

### Transição para Laboratório
- Botão flutuante no canto inferior direito: "Abrir Laboratório Avançado"
- Ou qualquer insight pode ter link "Explorar no Laboratório"

---

## 5. Canvas Central - Modo Laboratório

### Propósito
Exploração avançada com controle total do usuário. Ferramentas analíticas para investigação profunda.

### Estrutura: Tabs Horizontais

#### Tab 1: Distribuição
- **Gráfico Principal**: Treemap hierárquico interativo
  - Nível 1: Assuntos (retângulos grandes)
  - Nível 2: Tópicos (subdivisões dentro dos assuntos)
  - Nível 3: Subtópicos (mais granular)
  - Cores por assunto, intensidade por quantidade
  - Click em retângulo → zoom para aquele nível

- **Painel de Controle Lateral**:
  - Dropdown: "Agrupar por" (Assunto | Tópico | Subtópico | Conceito)
  - Slider: "Profundidade da hierarquia" (2-5 níveis)
  - Toggle: "Mostrar apenas anuladas"

- **Tabela de Dados (abaixo do gráfico)**:
  - Colunas: Categoria | Qtd. Questões | % do Total | Questões Anuladas | Avg. Dificuldade
  - Ordenável por qualquer coluna
  - Click em linha → filtra questões na Tab "Questões"

#### Tab 2: Similaridade
- **Gráfico de Rede Interativo**:
  - Nós = questões
  - Arestas = similaridade > threshold (configurável)
  - Clusters coloridos automaticamente
  - Zoom e pan habilitados

- **Controles**:
  - Slider: "Threshold de similaridade" (0.5 - 0.95)
  - Input: "Buscar questão por número"
  - Toggle: "Destacar apenas clusters grandes (>5 questões)"

- **Lista de Clusters Detectados**:
  - Tabela: Cluster ID | Tamanho | Conceito Comum | Avg. Similarity
  - Click em cluster → destaca no gráfico + abre lista de questões no painel direito

#### Tab 3: Temporal
- **Gráfico de Linha/Área**:
  - Eixo X: anos
  - Eixo Y: quantidade de questões
  - Múltiplas linhas (uma por assunto/tópico)
  - Legenda interativa (click para show/hide linha)

- **Heatmap Anual** (abaixo):
  - Linhas: assuntos/tópicos
  - Colunas: anos
  - Células coloridas por intensidade (mais questões = mais escuro)
  - Hover mostra tooltip com número exato

- **Detecção de Tendências**:
  - Box com insights automáticos: "Morfologia teve pico em 2022 (+60%)"

#### Tab 4: Questões (Tabela Master)
- **Tabela Completa e Filtrada**:
  - Colunas: # | Ano | Banca | Cargo | Assunto | Tópico | Status | Dificuldade | Ações
  - Filtros avançados acima da tabela:
    - Multiselect: Ano, Banca, Cargo, Status (Regular/Anulada)
    - Range slider: Confiança da classificação (0-100%)
    - Search input: busca textual no enunciado
  - Paginação: 50 questões por página
  - Click em linha → abre painel direito com análise completa

- **Ações em Massa**:
  - Checkbox para selecionar múltiplas questões
  - Botões: "Exportar Selecionadas" | "Adicionar ao Relatório Customizado"

### Navegação entre Tabs
- Tabs fixas no topo do canvas
- Transição suave (crossfade 250ms)
- Estado preservado ao trocar tabs

---

## 6. Painel Direito - Análise Profunda de Questão

### Trigger
- Click em qualquer questão (cards de Insights, tabela do Laboratório, nós do grafo)

### Animação de Entrada
- Slide from right (300ms cubic-bezier)
- Overlay escuro sutil no canvas central (opcional)

### Estrutura (scroll vertical)

#### Header
- Linha 1: `Questão #15 • FCC • 2024 • Analista TRT`
- Linha 2: Badge de status (Normal/Anulada) + Badge de disciplina colorido
- Botões: Fixar (📌) | Fechar (✕)

#### Bloco 1: Enunciado
- Texto completo da questão
- Formatação preservada (negrito, itálico)
- Imagens inline (se houver)
- Alternativas A-E listadas verticalmente
- Gabarito oficial destacado com border-left verde (#10b981)
- Se anulada: Banner amarelo com motivo (quando disponível)

#### Bloco 2: Classificação Hierárquica
- Tree view visual expandível:
  ```
  📚 Língua Portuguesa
    └─ 📖 Sintaxe (95%)
       └─ 🔹 Período Composto (92%)
          └─ 🔸 Orações Subordinadas Adverbiais (89%)
             └─ ⚡ Orações concessivas com inversão sintática (87%)
  ```
- Cada nível com badge de confiança (%)
- "Conceito Testado" em destaque:
  - Texto maior, box com bg levemente diferente
  - Explicação gerada pelo LLM (2-3 frases)

#### Bloco 3: Análise de Alternativas
- Tabela compacta:
  | Letra | Status | Justificativa |
  |-------|--------|---------------|
  | A     | ❌     | Erro: confunde oração concessiva com consecutiva... |
  | B     | ❌     | Erro: inversão sintática não altera a relação semântica... |
  | C     | ✅     | Correto: identifica corretamente a concessão apesar da ordem... |

- Identificação de "pegadinhas" comuns da banca
- Habilidade de Bloom testada: badge (Lembrar | Entender | Aplicar | Analisar | Avaliar | Criar)
- Nível de dificuldade: badge (Básico | Intermediário | Avançado)

#### Bloco 4: Contexto e Padrões
- **Questões Similares** (top 3):
  - Mini-cards com número, ano, banca
  - % de similaridade (ex: "87% similar")
  - Click navega para aquela questão

- Link: "Ver cluster completo no Laboratório" (abre Tab Similaridade com filtro aplicado)

- **Tags Automáticas**:
  - Pills com: #leitura-crítica, #inversão-sintática, #fcc-recorrente

---

## 7. Barra Superior - Controle Global

### Layout (esquerda → direita)

#### Bloco 1: Logo e Contexto (esquerda)
- Logo/nome do sistema: "Analisador de Questões"
- Dropdown: "Conjunto de Dados Ativo"
  - Mostra qual prova/conjunto está carregado: "FCC Analista 2024 (350 questões)"
  - Click: lista de todos os conjuntos importados
  - Opção de trocar

#### Bloco 2: Filtros Globais Rápidos (centro-esquerda)
- Chip pills toggleáveis:
  - Status: Todas | Apenas Regulares | Apenas Anuladas
  - Anos: Todos os Anos | Dropdown com multiselect
  - Bancas: Todas as Bancas | Dropdown com multiselect
- Badge numérico: "237 questões filtradas"
- Filtros aplicam em tempo real no Insights e Laboratório

#### Bloco 3: Ações Principais (centro-direita)
- Botão primário: "Importar PDFs" (abre modal de upload)
- Botão secundário: "Exportar Relatório" (gera MD/PDF do estado atual)
- Ícone de notificações (🔔) com badge de contagem
  - Dropdown com alertas: "Nova classificação concluída", "Erro ao processar PDF X"

#### Bloco 4: Configurações e Usuário (direita)
- Ícone de engrenagem (⚙️): Settings
  - Modal com: API keys do LLM, threshold de similaridade, modelo de embedding
- Avatar/menu do usuário (se houver autenticação)

---

## 8. Sistema Visual

### Paleta de Cores

#### Base Neutra (Dark Mode)
- **Fundo principal**: `#0a0e14` (cinza muito escuro, evoca terminal/IDE)
- **Superfícies elevadas**: `#161b22` (cards, painéis)
- **Bordas sutis**: `rgba(255, 255, 255, 0.1)`
- **Texto primário**: `#e6edf3` (branco suave)
- **Texto secundário**: `#8b949e` (cinza claro)

#### Cores de Dados (Categóricas - 12 disciplinas)
- Português: `#3b82f6` (azul)
- Matemática: `#f59e0b` (âmbar)
- Direito Constitucional: `#8b5cf6` (roxo)
- Direito Administrativo: `#ec4899` (rosa)
- Informática: `#06b6d4` (ciano)
- Raciocínio Lógico: `#10b981` (verde)
- Inglês: `#f97316` (laranja)
- Atualidades: `#eab308` (amarelo)
- Geografia: `#14b8a6` (teal)
- História: `#a855f7` (violeta)
- Física: `#0ea5e9` (azul claro)
- Química: `#84cc16` (lima)

#### Cores Semânticas
- **Sucesso/Correto**: `#10b981` (verde esmeralda)
- **Aviso/Anulada**: `#fbbf24` (amarelo ouro)
- **Erro/Incorreto**: `#ef4444` (vermelho coral)
- **Info/Neutral**: `#06b6d4` (azul ciano)

### Tipografia

#### Famílias
- **UI/Corpo**: Inter (Google Fonts) ou IBM Plex Sans
- **Monospace**: JetBrains Mono (para números, IDs, percentuais)
- **Fallback**: system-ui, -apple-system, sans-serif

#### Escala Modular
- **12px**: labels pequenas, metadados
- **14px**: corpo de texto padrão
- **16px**: texto destacado, inputs
- **20px**: subtítulos, headers de seção
- **28px**: títulos de página, números grandes

#### Pesos
- **400**: normal (corpo de texto)
- **500**: médio (labels, botões)
- **700**: bold (títulos, destaque)

### Espaçamento

#### Sistema de Grid (múltiplos de 4px)
- **4px**: espaçamento mínimo (entre ícone e texto)
- **8px**: gap compacto (entre chips, badges)
- **12px**: padding interno pequeno
- **16px**: padding padrão de cards, gap entre elementos
- **24px**: separação entre seções
- **32px**: margens grandes
- **48px**: espaçamento de página

#### Elevação (Shadows)
- **Nível 1** (cards): `0 1px 3px rgba(0,0,0,0.3)`
- **Nível 2** (modals, dropdowns): `0 4px 12px rgba(0,0,0,0.4)`
- **Nível 3** (painel direito): `0 8px 24px rgba(0,0,0,0.5)`

---

## 9. Interações e Microanimações

### Transições de Estado
- **Troca de disciplina**: fade out/in do canvas central (200ms ease-out)
- **Expansão do painel direito**: slide from right (300ms cubic-bezier(0.4, 0, 0.2, 1))
- **Troca Insights ↔ Laboratório**: crossfade (250ms)
- **Hover em cards**: elevação sutil + shadow (150ms ease-in-out)

### Feedback Visual
- **Botões ao clicar**: subtle scale(0.98) (100ms)
- **Filtros aplicados**: pulse animation no badge de contagem (1 ciclo)
- **Loading states**: skeleton screens (não spinners genéricos)
  - Cards: blocos cinzas pulsantes com mesma estrutura do card final
  - Gráficos: eixos visíveis + área de dados com shimmer effect
- **Gráficos ao carregar**: animação de entrada staggered
  - Barras: crescem de 0 a valor final (500ms, delay 50ms entre barras)
  - Linhas: desenham da esquerda para direita (800ms)

### Estados Interativos
- **Questões clicáveis**:
  - Hover: border-left colorida (disciplina) + bg `#ffffff05`
  - Active: bg `#ffffff08`
- **Chips de filtro**:
  - Não selecionado: bg transparente, border 1px
  - Selecionado: bg cor da categoria (20% opacity), checkmark animado
- **Upload de PDF (drag-and-drop)**:
  - Área default: border dashed cinza
  - Hover com arquivo: border sólida azul, bg azul 5% opacity
  - Soltando arquivo: pulse animation

---

## 10. Responsividade

### Breakpoints
- **Desktop**: ≥1280px (layout de 3 painéis)
- **Tablet**: 768px - 1279px (sidebar colapsável, 2 painéis)
- **Mobile**: <768px (navegação em tabs, 1 painel por vez)

### Adaptações por Breakpoint

#### Desktop (≥1280px)
- Layout completo: sidebar (240px) + canvas (flex) + painel direito (360px)
- Gráficos: tamanho completo, múltiplas colunas

#### Tablet (768px - 1279px)
- Sidebar: colapsável com ícone hamburger
  - Fechada: 64px (apenas ícones de disciplinas)
  - Aberta: 240px overlay sobre canvas
- Painel direito: 320px ou fullscreen modal
- Gráficos: adaptam largura, mantêm altura
- Tabelas: scroll horizontal com sticky first column

#### Mobile (<768px)
- Sidebar: vira bottom navigation (64px fixo no rodapé)
  - Mostra apenas ícones das 4 disciplinas principais
  - "Mais..." abre drawer com todas
- Canvas: fullscreen, sem painel direito
- Painel direito: vira modal fullscreen (slide from bottom)
- Gráficos:
  - Treemap vira lista vertical
  - Gráfico de rede desabilitado (muito complexo)
  - Tabelas: card view (1 questão = 1 card)
- Barra superior:
  - Logo + dropdown de dataset
  - Ações movem para menu hamburger

---

## 11. Fluxo de Dados

### Carregamento Inicial
```
1. App carrega
2. Fetch GET /api/datasets → lista de conjuntos importados
3. Se houver dataset ativo salvo em localStorage → carrega
   Senão → exibe tela "Importe PDFs para começar"
4. Usuário seleciona dataset → fetch GET /api/questoes?dataset_id=X
5. Estado global atualiza → sidebar popula com disciplinas
```

### Modo Insights
```
1. Usuário seleciona disciplina na sidebar
2. Frontend filtra questões localmente (array já em memória)
3. Cálculos no frontend:
   - Agrupamento por assunto/tópico (lodash groupBy)
   - Distribuição temporal (group by ano)
4. Fetch assíncrono para dados complementares:
   - GET /api/questoes/similares?disciplina=X&threshold=0.75
   - GET /api/questoes/anuladas?disciplina=X
5. Renderiza cards de insights com dados combinados
```

### Modo Laboratório
```
1. Dados já carregados do fetch inicial
2. Gráficos renderizam a partir do array filtrado
3. Filtros aplicam em memória (sem re-fetch):
   - Anos: array.filter(q => q.ano >= min && q.ano <= max)
   - Status: array.filter(q => q.anulada === true/false)
4. Ordenação de tabela: frontend (lodash orderBy)
5. Click em questão → fetch GET /api/questoes/:id/analise
   - Retorna: classificação completa + análise de alternativas
```

### Upload de PDF
```
1. Usuário arrasta PDF ou clica "Importar"
2. POST /api/upload/pdf (multipart/form-data)
   - Resposta imediata: { job_id: "uuid", status: "processing" }
3. Frontend inicia polling GET /api/jobs/:id (a cada 2s)
4. Backend processa:
   - Extração de texto/imagens (2-5min para 50 questões)
   - Classificação via LLM (3-10min dependendo do modelo)
   - Geração de embeddings (1-2min)
5. Status atualiza: "processing" → "completed" ou "failed"
6. Notificação push na barra superior: "Processamento concluído! 47 questões extraídas"
7. Frontend re-fetch /api/datasets para atualizar lista
```

### Sincronização de Estado
- **Estado global** (Context API ou Zustand):
  - `activeDataset`: objeto do dataset selecionado
  - `activeDisciplina`: string da disciplina filtrada
  - `questoes`: array completo de questões
  - `filtrosGlobais`: { status, anos, bancas }

- **Estado local** (useState):
  - Modo ativo (Insights/Laboratório)
  - Painel direito aberto/fechado + questão selecionada
  - Configurações de gráficos (threshold, agrupamento, etc.)

---

## 12. Componentes Reutilizáveis

### Componentes Básicos (Design System)
1. **Button**: variantes (primary, secondary, ghost), tamanhos (sm, md, lg)
2. **Badge**: cores semânticas + cores de disciplina
3. **Card**: elevação, padding, header/body/footer slots
4. **Input**: text, number, search com ícone
5. **Select/Dropdown**: single e multiselect
6. **Chip**: toggleável, removível
7. **Tooltip**: posição configurável
8. **Modal**: tamanhos (sm, md, lg, fullscreen)
9. **Skeleton**: placeholder para loading

### Componentes Compostos
1. **QuestionCard**:
   - Props: questao, onClick, compact (boolean)
   - Mostra: número, ano, banca, preview do enunciado, badges

2. **HierarchyTree**:
   - Props: classification (objeto hierárquico)
   - Renderiza: tree view com ícones + badges de confiança

3. **FilterBar**:
   - Props: filters (array), onChange
   - Renderiza: chips toggleáveis + badge de contagem

4. **InsightCard**:
   - Props: title, value, trend, chart (opcional)
   - Variantes: metric, alert, cluster

5. **AnalysisPanel**:
   - Props: questao (objeto completo com análise)
   - Renderiza: enunciado + classificação + alternativas + contexto

### Componentes de Gráfico (Recharts ou D3)
1. **TreemapChart**: hierarquia interativa com zoom
2. **NetworkGraph**: grafo de similaridade (D3 force layout)
3. **TimelineChart**: linha/área temporal
4. **HeatmapChart**: matriz ano x assunto
5. **DonutChart**: distribuição simples

---

## 13. Tecnologias e Bibliotecas

### Core
- **React 18+** (ou 19) com TypeScript
- **Vite** para build/dev server
- **React Router** para navegação (se necessário)

### Estado
- **Zustand** ou **Context API** para estado global
- **TanStack Query (React Query)** para fetching/caching

### UI e Estilo
- **TailwindCSS** para styling
- **Headless UI** ou **Radix UI** para componentes acessíveis (modal, dropdown, etc.)
- **Framer Motion** para animações

### Gráficos
- **Recharts** para gráficos básicos (barras, linhas, donuts)
- **D3.js** para gráficos customizados (rede, treemap avançado)
- **react-force-graph** (alternativa para network graph)

### Utilidades
- **lodash** para agrupamento/ordenação
- **date-fns** para manipulação de datas
- **clsx** ou **tailwind-merge** para composição de classes

---

## 14. Estrutura de Diretórios (Frontend)

```
src/
├── components/
│   ├── ui/              # Design system básico
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── ...
│   ├── charts/          # Componentes de gráfico
│   │   ├── TreemapChart.tsx
│   │   ├── NetworkGraph.tsx
│   │   └── ...
│   ├── features/        # Componentes de domínio
│   │   ├── QuestionCard.tsx
│   │   ├── AnalysisPanel.tsx
│   │   ├── InsightCard.tsx
│   │   └── ...
│   └── layout/          # Layout global
│       ├── Topbar.tsx
│       ├── Sidebar.tsx
│       └── MainLayout.tsx
├── pages/
│   ├── Insights.tsx
│   ├── Laboratory.tsx
│   └── Settings.tsx
├── hooks/
│   ├── useDatasets.ts
│   ├── useQuestoes.ts
│   └── useFilters.ts
├── store/
│   └── appStore.ts      # Zustand store
├── services/
│   └── api.ts           # Fetch helpers
├── types/
│   └── index.ts         # TypeScript types
├── utils/
│   ├── calculations.ts  # Agrupamentos, distribuições
│   └── colors.ts        # Mapa de cores por disciplina
├── App.tsx
└── main.tsx
```

---

## 15. Próximos Passos

1. **Validação do Design**: Apresentar ao usuário final para feedback
2. **Prototipação**: Criar wireframes interativos (Figma ou código)
3. **Desenvolvimento Incremental**:
   - Fase 1: Design system + layout básico + navegação
   - Fase 2: Modo Insights com cards estáticos (dados mockados)
   - Fase 3: Integração com API real
   - Fase 4: Modo Laboratório com gráficos básicos
   - Fase 5: Gráficos avançados (rede, treemap)
   - Fase 6: Painel de análise de questão
   - Fase 7: Upload de PDF + notificações
   - Fase 8: Polimento (animações, responsividade, testes)
4. **Testes**: Testes unitários (Vitest) + testes E2E (Playwright)
5. **Deploy**: Build de produção + deploy (Vercel/Netlify)

---

## 16. Considerações Finais

Este design foca em:
- **Inovação visual**: fuga de dashboards corporativos batidos
- **Profundidade analítica**: ferramentas para análise forense, não visualização superficial
- **Fluidez e descoberta**: transição natural de insights automáticos para exploração avançada
- **Precisão científica**: linguagem visual técnica e dados confiáveis

O sistema deve empoderar o concurseiro a entender padrões profundos das bancas, não apenas ver estatísticas bonitas.
