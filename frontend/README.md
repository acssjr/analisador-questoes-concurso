# Analisador de Questões - Frontend

Interface "Data Lab" para análise forense de questões de concurso.

## Stack

- React 19 + TypeScript
- Vite
- TailwindCSS v4
- Zustand (state management)
- Recharts (gráficos)
- Lodash (utilidades)

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Copiar .env de exemplo
cp .env.example .env

# Iniciar servidor de desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview
```

## Estrutura

```
src/
├── components/
│   ├── ui/              # Design system (Button, Badge, Card)
│   ├── charts/          # Gráficos (em desenvolvimento)
│   ├── features/        # Componentes de domínio (AnalysisPanel)
│   └── layout/          # Layout global (Topbar, Sidebar, MainLayout)
├── pages/
│   ├── Insights.tsx     # Modo Insights (visão automática)
│   └── Laboratory.tsx   # Modo Laboratório (exploração avançada)
├── store/
│   └── appStore.ts      # Zustand global state
├── services/
│   └── api.ts           # Cliente HTTP para backend
├── types/
│   └── index.ts         # TypeScript types
└── utils/
    ├── calculations.ts  # Agrupamentos, distribuições
    ├── colors.ts        # Cores por disciplina
    └── cn.ts            # Tailwind class merge
```

## Características do Design

- **Tema Dark**: Fundo #0a0e14, superfícies #161b22
- **Cores por Disciplina**: 12 cores únicas (Português #3b82f6, Matemática #f59e0b, etc.)
- **Tipografia**: Inter (UI), JetBrains Mono (números/dados)
- **Navegação**: SPA fluida, transições suaves
- **Responsivo**: Desktop, tablet, mobile

## Modos de Uso

### Modo Insights
Visão automática e inteligente:
- Overview cards (total, top 3 assuntos, alertas)
- Distribuição visual por assunto
- Questões recentes

### Modo Laboratório
Exploração avançada com 4 tabs:
- **Distribuição**: Treemap hierárquico (em desenvolvimento)
- **Similaridade**: Grafo de rede (em desenvolvimento)
- **Temporal**: Linha do tempo (em desenvolvimento)
- **Questões**: Tabela master com busca e filtros

## Dados Mockados

O frontend inclui 5 questões mockadas para desenvolvimento:
- 3 Português + 1 Matemática
- 1 questão anulada (para testar alerts)
- Classificações e alternativas completas

Para conectar ao backend real, configure `VITE_API_URL` no `.env`.

## Features Implementadas ✅

- ✅ **Design System completo**: Button, Badge, Card, Modal
- ✅ **Modo Insights**: Overview automático com cards, distribuição visual, alertas
- ✅ **Modo Laboratório**: 4 tabs com análises avançadas
  - Tab Distribuição: Treemap hierárquico interativo com Recharts
  - Tab Temporal: Timeline com evolução ao longo dos anos
  - Tab Similaridade: Placeholder para análise de backend
  - Tab Questões: Tabela master com busca e filtros
- ✅ **Upload de PDF**: Modal completo com drag-and-drop, validação, progress tracking
- ✅ **Sistema de Notificações**: Toast notifications com auto-dismiss, dropdown de histórico
- ✅ **Painel de Análise**: Slide-in panel com classificação hierárquica completa
- ✅ **Filtros Globais**: Status (todas/regulares/anuladas), anos, bancas
- ✅ **State Management**: Zustand com stores otimizadas
- ✅ **API Client**: Integração completa com backend FastAPI
- ✅ **Animações**: Transitions suaves (slideInRight, fadeIn, pulse)
- ✅ **Responsivo**: Layout adaptativo desktop/tablet/mobile
- ✅ **TypeScript**: Type-safe em 100% do código
- ✅ **Build Production**: Otimizado e pronto para deploy

## Próximos Passos (Opcionais)

- [ ] Implementar Settings modal (configurações de API, thresholds)
- [ ] Adicionar testes (Vitest + Testing Library)
- [ ] Melhorar gráfico de rede para similaridade (D3.js force graph)
- [ ] Adicionar exportação de relatórios (PDF/Excel)
- [ ] Integrar autenticação (se necessário)
- [ ] PWA + Service Worker para offline
- [ ] Code splitting para reduzir bundle size inicial
