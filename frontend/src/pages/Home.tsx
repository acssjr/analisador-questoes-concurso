import { useState } from 'react';
import { motion } from 'framer-motion';
import { EditalWorkflowModal } from '../components/features/EditalWorkflowModal';
import {
  IconUpload,
  IconBookOpen,
  IconTarget,
  IconChart,
  IconArrowRight,
  ProgressRing,
} from '../components/ui/Icons';

// Stat card component
function StatCard({
  icon: Icon,
  value,
  label,
  trend,
  delay,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  value: string | number;
  label: string;
  trend?: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="card p-5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
          <Icon size={20} className="text-[var(--accent-green)]" />
        </div>
        {trend && (
          <span className="badge badge-green text-[11px]">{trend}</span>
        )}
      </div>
      <p className="text-[28px] font-semibold text-[var(--text-primary)] text-mono mb-1">
        {value}
      </p>
      <p className="text-[13px] text-[var(--text-tertiary)]">{label}</p>
    </motion.div>
  );
}

// Feature card for empty state
function FeatureCard({
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex items-start gap-4 p-4 rounded-xl hover:bg-[var(--bg-subtle)] transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-[var(--accent-green)] bg-opacity-10 flex items-center justify-center flex-shrink-0">
        <Icon size={20} className="text-[var(--accent-green)]" />
      </div>
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
          {title}
        </h3>
        <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

// Step indicator
function StepBadge({ number, label }: { number: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-full bg-[var(--accent-green)] text-white text-[12px] font-semibold flex items-center justify-center">
        {number}
      </div>
      <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}

export function Home() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const features = [
    {
      icon: IconBookOpen,
      title: 'Extração Inteligente',
      description: 'Nossa IA extrai e classifica questões automaticamente de qualquer PDF de prova de concurso.',
    },
    {
      icon: IconTarget,
      title: 'Análise de Incidência',
      description: 'Visualize em 5 níveis hierárquicos quais assuntos mais aparecem nas provas anteriores.',
    },
    {
      icon: IconChart,
      title: 'Relatórios Detalhados',
      description: 'Gere relatórios com estatísticas de distribuição por ano, banca e cargo.',
    },
  ];

  const steps = [
    { number: 1, label: 'Crie um edital' },
    { number: 2, label: 'Importe as provas' },
    { number: 3, label: 'Analise os resultados' },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card-accent p-8 mb-8 relative overflow-hidden"
      >
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white blur-2xl" />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="max-w-lg">
            <p className="text-[12px] uppercase tracking-wider text-white/60 mb-2">
              Bem-vindo ao Analisador
            </p>
            <h1 className="text-title text-white mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              Descubra o que mais cai no seu concurso
            </h1>
            <p className="text-[15px] text-white/80 mb-6 leading-relaxed">
              Importe provas anteriores e deixe nossa IA analisar os padrões de incidência
              para otimizar seus estudos.
            </p>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="btn btn-lg bg-white text-[var(--accent-green)] hover:bg-white/90"
            >
              <IconUpload size={18} />
              Começar Agora
            </button>
          </div>

          {/* Progress illustration */}
          <div className="hidden lg:block">
            <div className="relative">
              <ProgressRing progress={72} size={140} strokeWidth={10} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[28px] font-bold text-white">72%</span>
                <span className="text-[11px] text-white/60">acurácia</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid - Empty State */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={IconBookOpen}
          value="0"
          label="Provas importadas"
          delay={0.1}
        />
        <StatCard
          icon={IconTarget}
          value="0"
          label="Questões extraídas"
          delay={0.2}
        />
        <StatCard
          icon={IconChart}
          value="0"
          label="Disciplinas"
          delay={0.3}
        />
      </div>

      {/* How it works + Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="card p-6"
        >
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-5">
            Como funciona
          </h2>
          <div className="space-y-4 mb-6">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center gap-4">
                <StepBadge number={step.number} label={step.label} />
                {index < steps.length - 1 && (
                  <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="btn btn-secondary w-full"
          >
            Criar primeiro edital
            <IconArrowRight size={16} />
          </button>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="card p-6"
        >
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-4">
            Recursos
          </h2>
          <div className="space-y-2">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={0.6 + index * 0.1}
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Upload Modal */}
      <EditalWorkflowModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={() => setIsUploadModalOpen(false)}
      />
    </div>
  );
}
