import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  FolderOpen,
  FileText,
  HelpCircle,
  TrendingUp,
  Plus,
  ChevronRight,
  BookOpen,
  Target,
  BarChart3,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { ProjetoWorkflowModal } from '../components/features/ProjetoWorkflowModal';
import { api } from '../services/api';
import type { Projeto } from '../types';

// Status labels
const statusLabels: Record<string, { label: string; color: string }> = {
  configurando: { label: 'Configurando', color: 'var(--text-muted)' },
  coletando: { label: 'Coletando', color: 'var(--accent-amber)' },
  analisando: { label: 'Analisando', color: 'var(--status-info)' },
  concluido: { label: 'Concluido', color: 'var(--status-success)' },
};

// Memoized stat card
const StatCard = memo(function StatCard({
  icon: Icon,
  value,
  label,
  trend,
  delay,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  value: string | number;
  label: string;
  trend?: string;
  delay: number;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <Icon size={20} className="text-[var(--accent-green)]" />
        </div>
        {trend && (
          <span className="text-[11px] font-medium text-[var(--status-success)] bg-emerald-50 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <p className="text-[28px] font-semibold text-gray-900 mb-1">{value}</p>
      <p className="text-[13px] text-gray-500">{label}</p>
    </motion.div>
  );
});

// Feature card for quick start
const FeatureCard = memo(function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
        <Icon size={20} className="text-[var(--accent-green)]" />
      </div>
      <div>
        <h4 className="text-[14px] font-medium text-gray-900 mb-1">{title}</h4>
        <p className="text-[13px] text-gray-500 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
});

// Step badge
const StepBadge = memo(function StepBadge({
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
        className={`w-7 h-7 rounded-full text-[12px] font-semibold flex items-center justify-center transition-colors ${
          isActive
            ? 'bg-[var(--accent-green)] text-white'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        {number}
      </div>
      <span
        className={`text-[13px] ${
          isActive ? 'text-gray-900 font-medium' : 'text-gray-500'
        }`}
      >
        {label}
      </span>
    </div>
  );
});

export function Home() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ provas: 0, questões: 0, disciplinas: 0 });

  useEffect(() => {
    async function loadData() {
      try {
        const projectsRes = await api.listProjetos();
        const projetosList = projectsRes.projetos || [];
        setProjetos(projetosList);

        // Calculate stats from projects
        const totalProvas = projetosList.reduce((sum, p) => sum + (p.total_provas || 0), 0);
        const totalQuestoes = projetosList.reduce((sum, p) => sum + (p.total_questoes || 0), 0);
        setStats({
          provas: totalProvas,
          questões: totalQuestoes,
          disciplinas: 0, // Will be calculated per project
        });
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const recentProjetos = projetos.slice(0, 5);

  const features = [
    {
      icon: BookOpen,
      title: 'Extração Inteligente',
      description: 'Nossa IA extrai e classifica questões automaticamente de qualquer PDF.',
    },
    {
      icon: Target,
      title: 'Análise de Incidência',
      description: 'Visualize em 5 níveis hierárquicos quais assuntos mais aparecem.',
    },
    {
      icon: BarChart3,
      title: 'Relatórios Detalhados',
      description: 'Gere relatórios com estatísticas de distribuição por ano e banca.',
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-[24px] font-semibold text-gray-900">
          Bem-vindo ao Analisador
        </h1>
        <p className="text-[14px] text-gray-500 mt-1">
          Descubra o que mais cai no seu concurso
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={FolderOpen}
          value={projetos.length}
          label="Projetos"
          delay={0.1}
          onClick={() => navigate('/projetos')}
        />
        <StatCard
          icon={FileText}
          value={stats.provas}
          label="Provas importadas"
          delay={0.15}
        />
        <StatCard
          icon={HelpCircle}
          value={stats.questões}
          label="Questões extraídas"
          delay={0.2}
        />
        <StatCard
          icon={TrendingUp}
          value={stats.disciplinas}
          label="Disciplinas"
          delay={0.25}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects - 2 columns */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white border border-gray-200 rounded-xl"
        >
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-gray-900">
                Projetos Recentes
              </h2>
              <p className="text-[13px] text-gray-500">
                Acesse rapidamente seus projetos
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary btn-sm"
            >
              <Plus size={16} />
              Novo Projeto
            </button>
          </div>

          <div className="p-5">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="text-gray-400 animate-spin" />
              </div>
            )}

            {!loading && recentProjetos.length === 0 && (
              <div className="text-center py-12">
                <FolderOpen size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-[14px] text-gray-500 mb-4">
                  Nenhum projeto ainda
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="btn btn-secondary btn-sm"
                >
                  Criar primeiro projeto
                </button>
              </div>
            )}

            {!loading && recentProjetos.length > 0 && (
              <div className="space-y-3">
                {recentProjetos.map((projeto) => {
                  const status = statusLabels[projeto.status] || statusLabels.configurando;
                  return (
                    <motion.div
                      key={projeto.id}
                      whileHover={{ x: 4 }}
                      onClick={() => navigate(`/projeto/${projeto.id}`)}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <FolderOpen size={18} className="text-[var(--accent-green)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[14px] font-medium text-gray-900 truncate group-hover:text-[var(--accent-green)] transition-colors">
                          {projeto.nome}
                        </h4>
                        <p className="text-[12px] text-gray-500">
                          {projeto.total_provas} provas • {projeto.total_questoes} questões
                        </p>
                      </div>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${status.color} 15%, transparent)`,
                          color: status.color,
                        }}
                      >
                        {status.label}
                      </span>
                      <ChevronRight
                        size={16}
                        className="text-gray-300 group-hover:text-[var(--accent-green)] transition-colors"
                      />
                    </motion.div>
                  );
                })}

                {projetos.length > 5 && (
                  <button
                    onClick={() => navigate('/projetos')}
                    className="w-full py-3 text-[13px] text-[var(--accent-green)] hover:bg-emerald-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    Ver todos os projetos
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Start - 1 column */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white border border-gray-200 rounded-xl"
        >
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-[16px] font-semibold text-gray-900">
              Como funciona
            </h2>
          </div>

          <div className="p-5 space-y-4">
            <StepBadge number={1} label="Crie um projeto" isActive />
            <div className="ml-3 pl-3 border-l-2 border-gray-100">
              <StepBadge number={2} label="Importe as provas" />
            </div>
            <div className="ml-3 pl-3 border-l-2 border-gray-100">
              <StepBadge number={3} label="Analise os resultados" />
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full mt-4 btn btn-secondary flex items-center justify-center gap-2"
            >
              Criar primeiro projeto
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Features Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6 bg-white border border-gray-200 rounded-xl p-5"
      >
        <h2 className="text-[16px] font-semibold text-gray-900 mb-4">
          Recursos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={0.45 + index * 0.05}
            />
          ))}
        </div>
      </motion.div>

      {/* Modal */}
      <ProjetoWorkflowModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUploadSuccess={() => {
          setIsModalOpen(false);
          // Reload data
          api.listProjetos().then((res) => setProjetos(res.projetos || []));
        }}
      />
    </div>
  );
}
