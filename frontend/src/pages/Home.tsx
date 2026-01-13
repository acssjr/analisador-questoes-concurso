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
  IconGithub,
} from '../components/ui/Icons';

// Stat card component - clickable with hover
function StatCard({
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
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card-interactive p-5"
    >
      <div className="flex items-start justify-between mb-4">
        <motion.div
          className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center"
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <Icon size={20} className="text-[var(--accent-green)]" />
        </motion.div>
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

// Feature card for empty state - clickable
function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  delay: number;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ x: 4, backgroundColor: 'var(--bg-subtle)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-colors group"
    >
      <motion.div
        className="w-10 h-10 rounded-xl bg-[rgba(27,67,50,0.1)] flex items-center justify-center flex-shrink-0"
        whileHover={{ scale: 1.1 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        <Icon size={20} className="text-[var(--accent-green)]" />
      </motion.div>
      <div className="flex-1">
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-green)] transition-colors">
          {title}
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>
      </div>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        whileHover={{ opacity: 1, x: 0 }}
        className="text-[var(--accent-green)] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <IconArrowRight size={16} />
      </motion.div>
    </motion.div>
  );
}

// Step indicator with animation
function StepBadge({ number, label, isActive }: { number: number; label: string; isActive?: boolean }) {
  return (
    <motion.div
      className="flex items-center gap-3"
      whileHover={{ x: 4 }}
      transition={{ type: "spring", stiffness: 400 }}
    >
      <motion.div
        className={`w-7 h-7 rounded-full text-[12px] font-semibold flex items-center justify-center transition-colors ${
          isActive
            ? 'bg-[var(--accent-green)] text-white'
            : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'
        }`}
        whileHover={{ scale: 1.15 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        {number}
      </motion.div>
      <span className={`text-[13px] transition-colors ${
        isActive ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'
      }`}>
        {label}
      </span>
    </motion.div>
  );
}

// Footer component
function Footer() {
  return (
    <footer className="footer">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-8 h-8 rounded-lg bg-[var(--accent-green)] flex items-center justify-center"
            >
              <IconBookOpen size={16} className="text-white" />
            </motion.div>
            <span className="text-[14px] font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
              Analisador de Questões
            </span>
          </div>

          <div className="flex items-center gap-6">
            <motion.a
              href="#"
              className="footer-link"
              whileHover={{ y: -2 }}
            >
              Documentação
            </motion.a>
            <motion.a
              href="#"
              className="footer-link"
              whileHover={{ y: -2 }}
            >
              Suporte
            </motion.a>
            <motion.a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link flex items-center gap-1.5"
              whileHover={{ y: -2 }}
            >
              <IconGithub size={14} />
              GitHub
            </motion.a>
          </div>

          <p className="text-[12px] text-[var(--text-muted)]">
            © 2024 Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
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
    <div className="min-h-full flex flex-col">
      <div className="flex-1 max-w-5xl mx-auto w-full py-8 px-4">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="card-accent p-8 mb-8 relative overflow-hidden"
        >
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-10">
            <motion.div
              className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white blur-3xl"
              animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.15, 0.1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white blur-2xl"
              animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.12, 0.1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="max-w-lg">
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-[12px] uppercase tracking-wider text-white/70 mb-2"
              >
                Bem-vindo ao Analisador
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-title text-white mb-3"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Descubra o que mais cai no seu concurso
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-[15px] text-white/80 mb-6 leading-relaxed"
              >
                Importe provas anteriores e deixe nossa IA analisar os padrões de incidência
                para otimizar seus estudos.
              </motion.p>
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsUploadModalOpen(true)}
                className="btn btn-lg bg-white text-[var(--accent-green)] hover:bg-white/95 shadow-lg"
              >
                <IconUpload size={18} />
                Começar Agora
              </motion.button>
            </div>

            {/* Progress illustration */}
            <motion.div
              className="hidden lg:block"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: "spring" }}
            >
              <motion.div
                className="relative"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <ProgressRing progress={72} size={140} strokeWidth={10} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[28px] font-bold text-white">72%</span>
                  <span className="text-[11px] text-white/70">acurácia</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Stats Grid - Empty State */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={IconBookOpen}
            value="0"
            label="Provas importadas"
            delay={0.1}
            onClick={() => setIsUploadModalOpen(true)}
          />
          <StatCard
            icon={IconTarget}
            value="0"
            label="Questões extraídas"
            delay={0.2}
            onClick={() => setIsUploadModalOpen(true)}
          />
          <StatCard
            icon={IconChart}
            value="0"
            label="Disciplinas"
            delay={0.3}
            onClick={() => setIsUploadModalOpen(true)}
          />
        </div>

        {/* How it works + Features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
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
                  <StepBadge number={step.number} label={step.label} isActive={index === 0} />
                  {index < steps.length - 1 && (
                    <motion.div
                      className="flex-1 h-px bg-[var(--border-subtle)]"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
                    />
                  )}
                </div>
              ))}
            </div>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setIsUploadModalOpen(true)}
              className="btn btn-secondary w-full group"
            >
              Criar primeiro edital
              <motion.span
                className="inline-block"
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <IconArrowRight size={16} />
              </motion.span>
            </motion.button>
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
                  onClick={() => setIsUploadModalOpen(true)}
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Call to action banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="card p-6 text-center mb-8"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-12 h-12 rounded-xl bg-[rgba(27,67,50,0.1)] flex items-center justify-center mx-auto mb-4"
          >
            <IconUpload size={24} className="text-[var(--accent-green)]" />
          </motion.div>
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
            Pronto para começar?
          </h3>
          <p className="text-[14px] text-[var(--text-secondary)] mb-4 max-w-md mx-auto">
            Importe seu primeiro edital e descubra quais assuntos têm maior incidência nas provas anteriores.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsUploadModalOpen(true)}
            className="btn btn-primary"
          >
            <IconUpload size={16} />
            Importar Edital
          </motion.button>
        </motion.div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Upload Modal */}
      <EditalWorkflowModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={() => setIsUploadModalOpen(false)}
      />
    </div>
  );
}
