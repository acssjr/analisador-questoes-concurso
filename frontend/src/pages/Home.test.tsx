import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '../test/test-utils';
import { MemoryRouter } from 'react-router';
import { Home } from './Home';
import { api } from '../services/api';

// Custom render with Router for Home component
const renderHome = async () => {
  let result;
  await act(async () => {
    result = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
  });
  return result;
};

// Mock the ProjetoWorkflowModal
vi.mock('../components/features/ProjetoWorkflowModal', () => ({
  ProjetoWorkflowModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="upload-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

// Mock the API
vi.mock('../services/api', () => ({
  api: {
    listProjetos: vi.fn(),
    deleteProjeto: vi.fn(),
  },
}));

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return empty projects list
    vi.mocked(api.listProjetos).mockResolvedValue({ projetos: [] });
  });

  it('should render the hero section with title', async () => {
    await renderHome();

    expect(screen.getByText('Descubra o que mais cai no seu concurso')).toBeInTheDocument();
  });

  it('should render the subtitle text', async () => {
    await renderHome();

    expect(screen.getByText(/Importe provas anteriores/i)).toBeInTheDocument();
    expect(screen.getByText(/padrões de incidência/i)).toBeInTheDocument();
  });

  it('should render the CTA button', async () => {
    await renderHome();

    // There are multiple "Começar" buttons - get all and check at least one exists
    const ctaButtons = screen.getAllByRole('button', { name: /Começar/i });
    expect(ctaButtons.length).toBeGreaterThan(0);
  });

  it('should open upload modal when CTA is clicked', async () => {
    await renderHome();

    // Click the first "Começar" button (the hero CTA)
    const ctaButtons = screen.getAllByRole('button', { name: /Começar/i });
    await act(async () => {
      fireEvent.click(ctaButtons[0]);
    });

    expect(screen.getByTestId('upload-modal')).toBeInTheDocument();
  });

  it('should close upload modal when close is triggered', async () => {
    await renderHome();

    // Open modal using the first "Começar" button
    const ctaButtons = screen.getAllByRole('button', { name: /Começar/i });
    await act(async () => {
      fireEvent.click(ctaButtons[0]);
    });

    expect(screen.getByTestId('upload-modal')).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByRole('button', { name: /Close Modal/i });
    await act(async () => {
      fireEvent.click(closeButton);
    });

    expect(screen.queryByTestId('upload-modal')).not.toBeInTheDocument();
  });

  it('should render the welcome badge', async () => {
    await renderHome();

    expect(screen.getByText('Bem-vindo ao Analisador')).toBeInTheDocument();
  });

  it('should render the three feature cards', async () => {
    await renderHome();

    expect(screen.getByText('Extração Inteligente')).toBeInTheDocument();
    expect(screen.getByText('Análise de Incidência')).toBeInTheDocument();
    expect(screen.getByText('Relatórios Detalhados')).toBeInTheDocument();
  });

  it('should render the step indicators', async () => {
    await renderHome();

    expect(screen.getByText('Crie um projeto')).toBeInTheDocument();
    expect(screen.getByText('Importe as provas')).toBeInTheDocument();
    expect(screen.getByText('Analise os resultados')).toBeInTheDocument();
  });

  it('should render the stats section when projects exist', async () => {
    // Mock API to return projects with stats
    vi.mocked(api.listProjetos).mockResolvedValue({
      projetos: [
        {
          id: '1',
          nome: 'Test Project',
          total_provas: 5,
          total_questoes: 100,
          status: 'concluido',
        },
      ],
    });

    await renderHome();

    // Wait for stats section to render (after loading completes)
    await waitFor(() => {
      expect(screen.getByText('Projetos')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify all stats labels are present
    expect(screen.getByText('Provas Importadas')).toBeInTheDocument();
    expect(screen.getByText('Questões Extraídas')).toBeInTheDocument();
  });

  it('should render the footer', async () => {
    await renderHome();

    expect(screen.getByText(/Todos os direitos reservados/i)).toBeInTheDocument();
    expect(screen.getByText('Documentação')).toBeInTheDocument();
    expect(screen.getByText('Suporte')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('should render the benefits section', async () => {
    await renderHome();

    expect(screen.getByText('Por que usar o Analisador?')).toBeInTheDocument();
    expect(screen.getByText('Economia de tempo')).toBeInTheDocument();
    expect(screen.getByText('Baseado em dados')).toBeInTheDocument();
    expect(screen.getByText('Fácil de usar')).toBeInTheDocument();
  });

  it('should render empty state when no projects', async () => {
    await renderHome();

    await waitFor(() => {
      expect(screen.getByText('Nenhum projeto ainda')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Criar Primeiro Projeto/i })).toBeInTheDocument();
  });
});
