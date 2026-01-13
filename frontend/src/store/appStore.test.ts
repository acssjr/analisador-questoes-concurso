import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './appStore';
import { mockQuestoes, mockEdital, mockIncidencia, mockFiltros } from '../test/mocks';

describe('appStore', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useAppStore.setState({
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
    });
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useAppStore.getState();

      expect(state.datasets).toEqual([]);
      expect(state.activeDataset).toBeNull();
      expect(state.questoes).toEqual([]);
      expect(state.activeDisciplina).toBeNull();
      expect(state.filtros).toEqual(mockFiltros);
      expect(state.modoCanvas).toBe('insights');
      expect(state.tabLaboratorio).toBe('distribuicao');
      expect(state.painelDireitoAberto).toBe(false);
      expect(state.questaoSelecionada).toBeNull();
      expect(state.editais).toEqual([]);
      expect(state.activeEdital).toBeNull();
      expect(state.incidencia).toEqual([]);
      expect(state.expandedNodes.size).toBe(0);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('questoes actions', () => {
    it('should set questoes', () => {
      useAppStore.getState().setQuestoes(mockQuestoes);

      const state = useAppStore.getState();
      expect(state.questoes).toEqual(mockQuestoes);
      expect(state.questoes.length).toBe(4);
    });

    it('should set empty questoes', () => {
      useAppStore.getState().setQuestoes(mockQuestoes);
      useAppStore.getState().setQuestoes([]);

      expect(useAppStore.getState().questoes).toEqual([]);
    });
  });

  describe('activeDisciplina actions', () => {
    it('should set active disciplina', () => {
      useAppStore.getState().setActiveDisciplina('Direito Constitucional');

      expect(useAppStore.getState().activeDisciplina).toBe('Direito Constitucional');
    });

    it('should clear active disciplina', () => {
      useAppStore.getState().setActiveDisciplina('Direito Constitucional');
      useAppStore.getState().setActiveDisciplina(null);

      expect(useAppStore.getState().activeDisciplina).toBeNull();
    });
  });

  describe('filtros actions', () => {
    it('should set partial filtros', () => {
      useAppStore.getState().setFiltros({ status: 'regulares' });

      const { filtros } = useAppStore.getState();
      expect(filtros.status).toBe('regulares');
      expect(filtros.anos).toEqual([]);
      expect(filtros.bancas).toEqual([]);
    });

    it('should merge filtros with existing state', () => {
      useAppStore.getState().setFiltros({ anos: [2022, 2023] });
      useAppStore.getState().setFiltros({ bancas: ['CESPE'] });

      const { filtros } = useAppStore.getState();
      expect(filtros.anos).toEqual([2022, 2023]);
      expect(filtros.bancas).toEqual(['CESPE']);
    });

    it('should update multiple filtros at once', () => {
      useAppStore.getState().setFiltros({
        status: 'anuladas',
        anos: [2021],
        bancas: ['FCC'],
      });

      const { filtros } = useAppStore.getState();
      expect(filtros.status).toBe('anuladas');
      expect(filtros.anos).toEqual([2021]);
      expect(filtros.bancas).toEqual(['FCC']);
    });
  });

  describe('modoCanvas actions', () => {
    it('should set modo canvas to laboratorio', () => {
      useAppStore.getState().setModoCanvas('laboratorio');

      expect(useAppStore.getState().modoCanvas).toBe('laboratorio');
    });

    it('should set modo canvas to insights', () => {
      useAppStore.getState().setModoCanvas('laboratorio');
      useAppStore.getState().setModoCanvas('insights');

      expect(useAppStore.getState().modoCanvas).toBe('insights');
    });
  });

  describe('tabLaboratorio actions', () => {
    it('should set tab laboratorio', () => {
      const tabs = ['distribuicao', 'temporal', 'similaridade', 'questoes'] as const;

      for (const tab of tabs) {
        useAppStore.getState().setTabLaboratorio(tab);
        expect(useAppStore.getState().tabLaboratorio).toBe(tab);
      }
    });
  });

  describe('painelDireito actions', () => {
    it('should open painel direito with questao', () => {
      const questao = mockQuestoes[0];
      useAppStore.getState().setPainelDireito(true, questao);

      const state = useAppStore.getState();
      expect(state.painelDireitoAberto).toBe(true);
      expect(state.questaoSelecionada).toEqual(questao);
    });

    it('should close painel direito', () => {
      useAppStore.getState().setPainelDireito(true, mockQuestoes[0]);
      useAppStore.getState().setPainelDireito(false);

      const state = useAppStore.getState();
      expect(state.painelDireitoAberto).toBe(false);
      expect(state.questaoSelecionada).toBeNull();
    });

    it('should open painel direito without questao', () => {
      useAppStore.getState().setPainelDireito(true);

      const state = useAppStore.getState();
      expect(state.painelDireitoAberto).toBe(true);
      expect(state.questaoSelecionada).toBeNull();
    });
  });

  describe('editais actions', () => {
    it('should set editais', () => {
      const editais = [mockEdital];
      useAppStore.getState().setEditais(editais);

      expect(useAppStore.getState().editais).toEqual(editais);
    });

    it('should set active edital', () => {
      useAppStore.getState().setActiveEdital(mockEdital);

      expect(useAppStore.getState().activeEdital).toEqual(mockEdital);
    });

    it('should clear active edital', () => {
      useAppStore.getState().setActiveEdital(mockEdital);
      useAppStore.getState().setActiveEdital(null);

      expect(useAppStore.getState().activeEdital).toBeNull();
    });
  });

  describe('incidencia actions', () => {
    it('should set incidencia', () => {
      useAppStore.getState().setIncidencia(mockIncidencia);

      expect(useAppStore.getState().incidencia).toEqual(mockIncidencia);
    });
  });

  describe('expandedNodes actions', () => {
    it('should toggle node expanded (add)', () => {
      useAppStore.getState().toggleNodeExpanded('Direito Constitucional');

      expect(useAppStore.getState().expandedNodes.has('Direito Constitucional')).toBe(true);
    });

    it('should toggle node expanded (remove)', () => {
      useAppStore.getState().toggleNodeExpanded('Direito Constitucional');
      useAppStore.getState().toggleNodeExpanded('Direito Constitucional');

      expect(useAppStore.getState().expandedNodes.has('Direito Constitucional')).toBe(false);
    });

    it('should handle multiple expanded nodes', () => {
      useAppStore.getState().toggleNodeExpanded('Node1');
      useAppStore.getState().toggleNodeExpanded('Node2');
      useAppStore.getState().toggleNodeExpanded('Node3');

      const { expandedNodes } = useAppStore.getState();
      expect(expandedNodes.size).toBe(3);
      expect(expandedNodes.has('Node1')).toBe(true);
      expect(expandedNodes.has('Node2')).toBe(true);
      expect(expandedNodes.has('Node3')).toBe(true);
    });
  });

  describe('loading actions', () => {
    it('should set loading to true', () => {
      useAppStore.getState().setLoading(true);

      expect(useAppStore.getState().isLoading).toBe(true);
    });

    it('should set loading to false', () => {
      useAppStore.getState().setLoading(true);
      useAppStore.getState().setLoading(false);

      expect(useAppStore.getState().isLoading).toBe(false);
    });
  });

  describe('datasets actions', () => {
    it('should set datasets', () => {
      const datasets = [{ id: '1', nome: 'Dataset 1', total_questoes: 100, data_criacao: '2023-01-01' }];
      useAppStore.getState().setDatasets(datasets);

      expect(useAppStore.getState().datasets).toEqual(datasets);
    });

    it('should set active dataset', () => {
      const dataset = { id: '1', nome: 'Dataset 1', total_questoes: 100, data_criacao: '2023-01-01' };
      useAppStore.getState().setActiveDataset(dataset);

      expect(useAppStore.getState().activeDataset).toEqual(dataset);
    });
  });
});
