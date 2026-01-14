import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../test/test-utils';
import { Dashboard } from './Dashboard';
import { useAppStore } from '../store/appStore';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, onClick, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} style={style} onClick={onClick} {...props}>{children}</div>
    ),
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the store
vi.mock('../store/appStore', () => ({
  useAppStore: vi.fn(),
}));

const mockUseAppStore = vi.mocked(useAppStore);

describe('Dashboard', () => {
  const mockEdital = {
    id: 'edital-123',
    nome: 'Concurso TRT',
    arquivo_url: '/files/edital.pdf',
    data_upload: '2024-01-15T10:00:00Z',
    banca: 'FCC',
    orgao: 'TRT',
    ano: 2024,
    total_provas: 3,
    total_questoes: 180,
    cargos: ['Analista'],
    conteudo_programatico: {
      disciplinas: [
        {
          nome: 'Língua Portuguesa',
          itens: [
            { id: '1', texto: 'Interpretação de texto', filhos: [] },
            { id: '2', texto: 'Gramática', filhos: [] },
          ],
        },
        {
          nome: 'Raciocínio Lógico',
          itens: [
            { id: '1', texto: 'Proposições', filhos: [] },
          ],
        },
      ],
    },
  };

  const mockQuestoes = [
    {
      id: 'q1',
      numero: 1,
      ano: 2023,
      banca: 'FCC',
      cargo: 'Analista',
      disciplina: 'Português',
      enunciado: 'Questão 1',
      alternativas: { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' },
      gabarito: 'A',
      anulada: false,
    },
    {
      id: 'q2',
      numero: 2,
      ano: 2023,
      banca: 'FCC',
      cargo: 'Analista',
      disciplina: 'Matemática',
      enunciado: 'Questão 2',
      alternativas: { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' },
      gabarito: 'B',
      anulada: false,
    },
  ];

  const mockIncidencia = [
    {
      nome: 'Língua Portuguesa',
      count: 10,
      percentual: 50,
      questoes: [],
      children: [
        { nome: 'Gramática', count: 5, percentual: 25, questoes: [], children: [] },
        { nome: 'Interpretação', count: 5, percentual: 25, questoes: [], children: [] },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when no edital is selected', () => {
    it('should show empty state message', () => {
      mockUseAppStore.mockImplementation(<T,>(selector: (state: unknown) => T): T => {
        const state = {
          activeEdital: null,
          questoes: [],
          incidencia: [],
          expandedNodes: new Set(),
          toggleNodeExpanded: vi.fn(),
          setActiveEdital: vi.fn(),
          setModoCanvas: vi.fn(),
          setPainelDireito: vi.fn(),
        };
        return selector(state);
      });

      render(<Dashboard />);

      expect(screen.getByText(/Nenhum edital selecionado/i)).toBeInTheDocument();
    });
  });

  describe('when edital is selected', () => {
    beforeEach(() => {
      mockUseAppStore.mockImplementation(<T,>(selector: (state: unknown) => T): T => {
        const state = {
          activeEdital: mockEdital,
          questoes: mockQuestoes,
          incidencia: mockIncidencia,
          expandedNodes: new Set(),
          toggleNodeExpanded: vi.fn(),
          setActiveEdital: vi.fn(),
          setModoCanvas: vi.fn(),
          setPainelDireito: vi.fn(),
        };
        return selector(state);
      });
    });

    it('should show edital name', () => {
      render(<Dashboard />);

      expect(screen.getByText(/Concurso TRT/i)).toBeInTheDocument();
    });

    it('should show banca info', () => {
      render(<Dashboard />);

      expect(screen.getByText(/FCC/i)).toBeInTheDocument();
    });

    it('should show year', () => {
      render(<Dashboard />);

      expect(screen.getByText(/2024/)).toBeInTheDocument();
    });

    it('should display stat cards', () => {
      render(<Dashboard />);

      // Should have stats for questões
      expect(screen.getByText(/Questões Extraídas/i)).toBeInTheDocument();
    });
  });

  describe('incidencia tree', () => {
    beforeEach(() => {
      mockUseAppStore.mockImplementation(<T,>(selector: (state: unknown) => T): T => {
        const state = {
          activeEdital: mockEdital,
          questoes: mockQuestoes,
          incidencia: mockIncidencia,
          expandedNodes: new Set(),
          toggleNodeExpanded: vi.fn(),
          setActiveEdital: vi.fn(),
          setModoCanvas: vi.fn(),
          setPainelDireito: vi.fn(),
        };
        return selector(state);
      });
    });

    it('should display discipline names', () => {
      render(<Dashboard />);

      expect(screen.getByText(/Língua Portuguesa/i)).toBeInTheDocument();
    });

    it('should show question counts', () => {
      render(<Dashboard />);

      // Should show count of 10 for Língua Portuguesa
      expect(screen.getByText(/10 questões/)).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should have back button', () => {
      mockUseAppStore.mockImplementation(<T,>(selector: (state: unknown) => T): T => {
        const state = {
          activeEdital: mockEdital,
          questoes: mockQuestoes,
          incidencia: mockIncidencia,
          expandedNodes: new Set(),
          toggleNodeExpanded: vi.fn(),
          setActiveEdital: vi.fn(),
          setModoCanvas: vi.fn(),
          setPainelDireito: vi.fn(),
        };
        return selector(state);
      });

      render(<Dashboard />);

      const backButton = screen.getByRole('button', { name: /voltar/i });
      expect(backButton).toBeInTheDocument();
    });

    it('should clear edital on back click', () => {
      const mockSetActiveEdital = vi.fn();

      mockUseAppStore.mockImplementation(<T,>(selector: (state: unknown) => T): T => {
        const state = {
          activeEdital: mockEdital,
          questoes: mockQuestoes,
          incidencia: mockIncidencia,
          expandedNodes: new Set(),
          toggleNodeExpanded: vi.fn(),
          setActiveEdital: mockSetActiveEdital,
          setModoCanvas: vi.fn(),
          setPainelDireito: vi.fn(),
        };
        return selector(state);
      });

      render(<Dashboard />);

      const backButton = screen.getByRole('button', { name: /voltar/i });
      fireEvent.click(backButton);

      expect(mockSetActiveEdital).toHaveBeenCalledWith(null);
    });
  });
});
