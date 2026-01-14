import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../test/test-utils';
import { MemoryRouter } from 'react-router';
import { Home } from './Home';

// Custom render with Router for Home component
const renderHome = () => {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
};

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button onClick={onClick} {...props}>
        {children}
      </button>
    ),
    tr: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => <tr {...props}>{children}</tr>,
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
    h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h1 {...props}>{children}</h1>,
    a: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the EditalWorkflowModal
vi.mock('../components/features/EditalWorkflowModal', () => ({
  EditalWorkflowModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="upload-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the hero section with title', () => {
    renderHome();

    expect(screen.getByText('Descubra o que mais cai no seu concurso')).toBeInTheDocument();
  });

  it('should render the subtitle text', () => {
    renderHome();

    expect(screen.getByText(/Importe provas anteriores/i)).toBeInTheDocument();
    expect(screen.getByText(/padrões de incidência/i)).toBeInTheDocument();
  });

  it('should render the CTA button', () => {
    renderHome();

    const ctaButton = screen.getByRole('button', { name: /Começar Agora/i });
    expect(ctaButton).toBeInTheDocument();
  });

  it('should open upload modal when CTA is clicked', () => {
    renderHome();

    const ctaButton = screen.getByRole('button', { name: /Começar Agora/i });
    fireEvent.click(ctaButton);

    expect(screen.getByTestId('upload-modal')).toBeInTheDocument();
  });

  it('should close upload modal when close is triggered', () => {
    renderHome();

    // Open modal
    const ctaButton = screen.getByRole('button', { name: /Começar Agora/i });
    fireEvent.click(ctaButton);

    expect(screen.getByTestId('upload-modal')).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByRole('button', { name: /Close Modal/i });
    fireEvent.click(closeButton);

    expect(screen.queryByTestId('upload-modal')).not.toBeInTheDocument();
  });

  it('should render the welcome badge', () => {
    renderHome();

    expect(screen.getByText('Bem-vindo ao Analisador')).toBeInTheDocument();
  });

  it('should render the three feature cards', () => {
    renderHome();

    expect(screen.getByText('Extração Inteligente')).toBeInTheDocument();
    expect(screen.getByText('Análise de Incidência')).toBeInTheDocument();
    expect(screen.getByText('Relatórios Detalhados')).toBeInTheDocument();
  });

  it('should render the step indicators', () => {
    renderHome();

    expect(screen.getByText('Crie um edital')).toBeInTheDocument();
    expect(screen.getByText('Importe as provas')).toBeInTheDocument();
    expect(screen.getByText('Analise os resultados')).toBeInTheDocument();
  });

  it('should render the stats section', () => {
    renderHome();

    // Initial state shows 0 for all stats
    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.getByText('Provas importadas')).toBeInTheDocument();
    expect(screen.getByText('Questões extraídas')).toBeInTheDocument();
    expect(screen.getByText('Disciplinas')).toBeInTheDocument();
  });

  it('should render the footer', () => {
    renderHome();

    expect(screen.getByText(/Todos os direitos reservados/i)).toBeInTheDocument();
    expect(screen.getByText('Documentação')).toBeInTheDocument();
    expect(screen.getByText('Suporte')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('should render the call to action banner', () => {
    renderHome();

    expect(screen.getByText('Pronto para começar?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar Edital/i })).toBeInTheDocument();
  });
});
