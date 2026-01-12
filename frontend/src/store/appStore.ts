import { create } from 'zustand';
import type { Dataset, Questao, FiltrosGlobais, ModoCanvas, TabLaboratorio, QuestaoCompleta, Edital, IncidenciaNode } from '../types';

interface AppState {
  // Datasets
  datasets: Dataset[];
  activeDataset: Dataset | null;
  setDatasets: (datasets: Dataset[]) => void;
  setActiveDataset: (dataset: Dataset | null) => void;

  // Questões
  questoes: Questao[];
  setQuestoes: (questoes: Questao[]) => void;

  // Disciplina ativa
  activeDisciplina: string | null;
  setActiveDisciplina: (disciplina: string | null) => void;

  // Filtros globais
  filtros: FiltrosGlobais;
  setFiltros: (filtros: Partial<FiltrosGlobais>) => void;

  // Modo canvas
  modoCanvas: ModoCanvas;
  setModoCanvas: (modo: ModoCanvas) => void;

  // Tab ativa do laboratório
  tabLaboratorio: TabLaboratorio;
  setTabLaboratorio: (tab: TabLaboratorio) => void;

  // Painel direito
  painelDireitoAberto: boolean;
  questaoSelecionada: QuestaoCompleta | null;
  setPainelDireito: (aberto: boolean, questao?: QuestaoCompleta | null) => void;

  // Editais
  editais: Edital[];
  activeEdital: Edital | null;
  setEditais: (editais: Edital[]) => void;
  setActiveEdital: (edital: Edital | null) => void;

  // Incidência hierárquica
  incidencia: IncidenciaNode[];
  setIncidencia: (incidencia: IncidenciaNode[]) => void;

  // Nó expandido na árvore de incidência
  expandedNodes: Set<string>;
  toggleNodeExpanded: (nodePath: string) => void;

  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Estado inicial
  datasets: [],
  activeDataset: null,
  questoes: [],
  activeDisciplina: null,
  filtros: {
    status: 'todas',
    anos: [],
    bancas: [],
  },
  modoCanvas: 'insights',
  tabLaboratorio: 'distribuicao',
  painelDireitoAberto: false,
  questaoSelecionada: null,
  editais: [],
  activeEdital: null,
  incidencia: [],
  expandedNodes: new Set<string>(),
  isLoading: false,

  // Actions
  setDatasets: (datasets) => set({ datasets }),
  setActiveDataset: (activeDataset) => set({ activeDataset }),
  setQuestoes: (questoes) => set({ questoes }),
  setActiveDisciplina: (activeDisciplina) => set({ activeDisciplina }),
  setFiltros: (novosFiltros) => set((state) => ({
    filtros: { ...state.filtros, ...novosFiltros }
  })),
  setModoCanvas: (modoCanvas) => set({ modoCanvas }),
  setTabLaboratorio: (tabLaboratorio) => set({ tabLaboratorio }),
  setPainelDireito: (aberto, questao = null) => set({
    painelDireitoAberto: aberto,
    questaoSelecionada: questao
  }),
  setEditais: (editais) => set({ editais }),
  setActiveEdital: (activeEdital) => set({ activeEdital }),
  setIncidencia: (incidencia) => set({ incidencia }),
  toggleNodeExpanded: (nodePath) => set((state) => {
    const newSet = new Set(state.expandedNodes);
    if (newSet.has(nodePath)) {
      newSet.delete(nodePath);
    } else {
      newSet.add(nodePath);
    }
    return { expandedNodes: newSet };
  }),
  setLoading: (isLoading) => set({ isLoading }),
}));
