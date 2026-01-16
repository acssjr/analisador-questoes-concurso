import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ProjetoWorkflowModal } from '../components/features/ProjetoWorkflowModal';
import { api } from '../services/api';
import type { Projeto } from '../types';
import {
  IconUpload,
  IconBookOpen,
  IconTarget,
  IconChart,
  IconArrowRight,
  IconPlus,
  IconFolder,
  IconChevronRight,
  IconTrash,
  IconGithub,
  IconSpinner,
  IconCheck,
} from '../components/ui/Icons';

// Status configuration with proper colors
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  configurando: {
    label: 'Configurando',
    color: 'var(--text-tertiary)',
    bgColor: 'var(--bg-muted)',
  },
  coletando: {
    label: 'Coletando',
    color: 'var(--status-warning)',
    bgColor: 'var(--status-warning-bg)',
  },
  analisando: {
    label: 'Analisando',
    color: 'var(--status-info)',
    bgColor: 'var(--status-info-bg)',
  },
  concluido: {
    label: 'Concluído',
    color: 'var(--status-success)',
    bgColor: 'var(--status-success-bg)',
  },
};

// Feature item component - simplified, no complex animations
function FeatureItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-[var(--bg-subtle)] transition-colors duration-200">
      <div className="w-10 h-10 rounded-xl bg-[rgba(27,67,50,0.08)] flex items-center justify-center flex-shrink-0">
        <Icon size={20} className="text-[var(--accent-green)]" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
          {title}
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

// Step indicator component - simplified
function StepItem({
  number,
  label,
  isActive,
}: {
  number: number;
  label: string;
  isActive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-full text-[13px] font-semibold flex items-center justify-center transition-colors duration-200 ${
          isActive
            ? 'bg-[var(--accent-green)] text-white'
            : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'
        }`}
      >
        {number}
      </div>
      <span
        className={`text-[14px] transition-colors duration-200 ${
          isActive
            ? 'text-[var(--text-primary)] font-medium'
            : 'text-[var(--text-secondary)]'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// Project card component - cleaner design with subtle hover
function ProjectCard({
  projeto,
  onClick,
  onDelete,
}: {
  projeto: Projeto;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const status = statusConfig[projeto.status] || statusConfig.configurando;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="text-left card p-5 group cursor-pointer hover:border-[var(--accent-green)] hover:shadow-lg transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[rgba(27,67,50,0.08)] flex items-center justify-center flex-shrink-0">
            <IconFolder size={20} className="text-[var(--accent-green)]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-green)] transition-colors duration-200 truncate">
              {projeto.nome}
            </h3>
            <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5 truncate">
              {projeto.banca && `${projeto.banca} `}
              {projeto.ano && `• ${projeto.ano} `}
              {projeto.cargo && `• ${projeto.cargo}`}
              {!projeto.banca && !projeto.ano && !projeto.cargo && 'Sem metadados'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--status-error)] transition-colors duration-200 opacity-0 group-hover:opacity-100"
            aria-label="Excluir projeto"
          >
            <IconTrash size={14} />
          </button>
          <IconChevronRight
            size={18}
            className="text-[var(--text-muted)] group-hover:text-[var(--accent-green)] transition-colors duration-200"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 text-[12px] mb-3">
        <span className="text-[var(--text-secondary)]">
          <span className="text-[var(--text-primary)] font-medium font-mono">
            {projeto.total_provas}
          </span>{' '}
          provas
        </span>
        <span className="text-[var(--text-secondary)]">
          <span className="text-[var(--text-primary)] font-medium font-mono">
            {projeto.total_questoes}
          </span>{' '}
          questões
        </span>
      </div>

      <div className="pt-3 border-t border-[var(--border-subtle)]">
        <span
          className="text-[11px] font-medium px-2.5 py-1 rounded-full inline-block"
          style={{
            backgroundColor: status.bgColor,
            color: status.color,
          }}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}

// Stat card component - simplified
function StatCard({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div className="card p-5 text-center">
      <p className="text-[28px] font-semibold text-[var(--accent-green)] font-mono mb-1">
        {value}
      </p>
      <p className="text-[13px] text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}

// Footer component with dynamic year
function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-green)] flex items-center justify-center">
              <IconBookOpen size={16} className="text-white" />
            </div>
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">
              Analisador de Questões
            </span>
          </div>

          <nav className="flex items-center gap-6">
            <a href="#" className="footer-link">
              Documentação
            </a>
            <a href="#" className="footer-link">
              Suporte
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link flex items-center gap-1.5"
            >
              <IconGithub size={14} />
              GitHub
            </a>
          </nav>

          <p className="text-[12px] text-[var(--text-muted)]">
            © {currentYear} Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}

export function Home() {
  const navigate = useNavigate();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load projects (stats are auto-calculated from projects state)
  useEffect(() => {
    async function loadData() {
      try {
        const projectsResponse = await api.listProjetos();
        // Update projects state - this will trigger stats recalculation
        setProjetos(projectsResponse.projetos || []);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [refreshKey]);

  function refreshData() {
    setRefreshKey((k) => k + 1);
  }

  function handleNewProject() {
    setIsUploadModalOpen(true);
  }

  function handleProjectClick(projeto: Projeto) {
    navigate(`/projeto/${projeto.id}`);
  }

  async function handleDeleteProject(e: React.MouseEvent, projeto: Projeto) {
    e.stopPropagation();
    if (!confirm(`Tem certeza que deseja excluir "${projeto.nome}"?`)) return;

    try {
      await api.deleteProjeto(projeto.id);
      setProjetos((prev) => prev.filter((p) => p.id !== projeto.id));
    } catch (err) {
      console.error('Erro ao excluir projeto:', err);
      alert('Erro ao excluir projeto');
    }
  }

  const features = [
    {
      icon: IconBookOpen,
      title: 'Extração Inteligente',
      description:
        'Nossa IA extrai e classifica questões automaticamente de qualquer PDF de prova.',
    },
    {
      icon: IconTarget,
      title: 'Análise de Incidência',
      description:
        'Visualize em 5 níveis hierárquicos quais assuntos mais aparecem nas provas.',
    },
    {
      icon: IconChart,
      title: 'Relatórios Detalhados',
      description:
        'Estatísticas de distribuição por ano, banca e cargo para guiar seus estudos.',
    },
  ];

  const steps = [
    { number: 1, label: 'Crie um projeto', isActive: true },
    { number: 2, label: 'Importe as provas', isActive: false },
    { number: 3, label: 'Analise os resultados', isActive: false },
  ];

  const benefits = [
    { label: 'Economia de tempo', desc: 'Foque nos assuntos certos' },
    { label: 'Baseado em dados', desc: 'Análise de provas reais' },
    { label: 'Fácil de usar', desc: 'Upload simples de PDFs' },
  ];

  // Calculate stats from projects
  const totalProvas = projetos.reduce((sum, p) => sum + (p.total_provas || 0), 0);
  const totalQuestoes = projetos.reduce((sum, p) => sum + (p.total_questoes || 0), 0);

  return (
    <div className="min-h-full flex flex-col">
      <div className="flex-1 max-w-6xl mx-auto w-full py-8 px-6">
        {/* Hero Section - Clean design with good contrast */}
        <section className="card-accent p-8 md:p-10 mb-10 relative overflow-hidden animate-fade-in">
          <div className="relative z-10 max-w-2xl">
            <p className="text-[12px] uppercase tracking-wider text-white font-medium mb-3 opacity-90">
              Bem-vindo ao Analisador
            </p>
            <h1
              className="text-[28px] md:text-[32px] font-semibold text-white mb-4 leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Descubra o que mais cai no seu concurso
            </h1>
            <p className="text-[15px] text-white mb-6 leading-relaxed max-w-lg opacity-90">
              Importe provas anteriores e deixe nossa IA analisar os padrões de
              incidência para otimizar seus estudos.
            </p>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="btn btn-lg bg-white text-[var(--accent-green)] hover:bg-white/95 shadow-lg font-semibold"
            >
              <IconUpload size={18} />
              Começar Agora
            </button>
          </div>

          {/* Subtle decorative background */}
          <div
            className="absolute top-0 right-0 w-72 h-72 rounded-full bg-white/5 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 left-1/2 w-56 h-56 rounded-full bg-white/5 blur-2xl"
            aria-hidden="true"
          />
        </section>

        {/* Stats Bar - Only show if has projects */}
        {!loading && projetos.length > 0 && (
          <section className="grid grid-cols-3 gap-4 mb-10 animate-fade-in-up">
            <StatCard value={projetos.length} label="Projetos" />
            <StatCard value={totalProvas} label="Provas Importadas" />
            <StatCard value={totalQuestoes} label="Questões Extraídas" />
          </section>
        )}

        {/* Projects Section */}
        {!loading && projetos.length > 0 && (
          <section className="mb-10 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[20px] font-semibold text-[var(--text-primary)]">
                  Meus Projetos
                </h2>
                <p className="text-[14px] text-[var(--text-secondary)] mt-1">
                  Gerencie seus projetos de análise de questões
                </p>
              </div>
              <button onClick={handleNewProject} className="btn btn-primary">
                <IconPlus size={18} />
                Novo Projeto
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projetos.map((projeto) => (
                <ProjectCard
                  key={projeto.id}
                  projeto={projeto}
                  onClick={() => handleProjectClick(projeto)}
                  onDelete={(e) => handleDeleteProject(e, projeto)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <IconSpinner size={32} className="text-[var(--accent-green)]" />
          </div>
        )}

        {/* Empty state */}
        {!loading && projetos.length === 0 && (
          <section className="card p-10 text-center mb-10 animate-fade-in-up">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-5">
              <IconFolder size={32} className="text-[var(--text-muted)]" />
            </div>
            <h3 className="text-[18px] font-semibold text-[var(--text-primary)] mb-2">
              Nenhum projeto ainda
            </h3>
            <p className="text-[14px] text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
              Crie seu primeiro projeto para começar a analisar provas de concurso
            </p>
            <button onClick={handleNewProject} className="btn btn-primary">
              <IconPlus size={18} />
              Criar Primeiro Projeto
            </button>
          </section>
        )}

        {/* How it works + Features */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          {/* How it works */}
          <div className="card p-6 animate-fade-in-up delay-1">
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)] mb-6">
              Como funciona
            </h2>
            <div className="space-y-5 mb-6">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                  <StepItem
                    number={step.number}
                    label={step.label}
                    isActive={step.isActive}
                  />
                  {index < steps.length - 1 && (
                    <div className="flex-1 h-px bg-[var(--border-subtle)] mx-4" />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="btn btn-secondary w-full group"
            >
              Começar agora
              <IconArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform duration-200"
              />
            </button>
          </div>

          {/* Features */}
          <div className="card p-6 animate-fade-in-up delay-2">
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)] mb-4">
              Recursos
            </h2>
            <div className="space-y-1">
              {features.map((feature) => (
                <FeatureItem
                  key={feature.title}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Benefits section */}
        <section className="card p-8 mb-12 bg-[var(--bg-subtle)] border-0 animate-fade-in-up delay-3">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-[20px] font-semibold text-[var(--text-primary)] mb-4">
              Por que usar o Analisador?
            </h2>
            <p className="text-[15px] text-[var(--text-secondary)] mb-8 leading-relaxed">
              Estudar para concursos exige estratégia. Nossa ferramenta identifica os
              assuntos mais cobrados para você focar no que realmente importa.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {benefits.map((benefit) => (
                <div key={benefit.label} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--accent-green)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <IconCheck size={14} className="text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-[14px] font-medium text-[var(--text-primary)]">
                      {benefit.label}
                    </p>
                    <p className="text-[13px] text-[var(--text-secondary)]">
                      {benefit.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <Footer />

      <ProjetoWorkflowModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={() => {
          setIsUploadModalOpen(false);
          refreshData();
        }}
      />
    </div>
  );
}
