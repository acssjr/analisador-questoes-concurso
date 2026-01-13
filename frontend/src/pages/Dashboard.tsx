import { motion } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import type { IncidenciaNode, Questao } from '../types';
import {
  IconBookOpen,
  IconTarget,
  IconChart,
  IconCheck,
  IconX,
  IconFileText,
  IconBuilding,
  IconCalendar,
  IconArrowLeft,
  IconChevronRight,
  IconFlask,
  IconUsers,
  IconAlertTriangle,
} from '../components/ui/Icons';

// Stat card component
function StatCard({
  icon: Icon,
  value,
  label,
  variant = 'default',
  delay = 0,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  value: string | number;
  label: string;
  variant?: 'default' | 'success' | 'warning';
  delay?: number;
}) {
  const variantStyles = {
    default: 'text-[var(--accent-green)]',
    success: 'text-[var(--accent-green)]',
    warning: 'text-[var(--accent-amber)]',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="card p-5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
          <Icon size={20} className={variantStyles[variant]} />
        </div>
      </div>
      <p className="text-[28px] font-semibold text-[var(--text-primary)] text-mono mb-1">
        {value}
      </p>
      <p className="text-[13px] text-[var(--text-tertiary)]">{label}</p>
    </motion.div>
  );
}

// Year badge
function YearBadge({ year, count }: { year: number; count: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-subtle)] rounded-lg">
      <span className="text-[13px] font-medium text-[var(--text-primary)]">{year}</span>
      <span className="text-[11px] text-[var(--text-muted)]">{count} questões</span>
    </div>
  );
}

// Tree level colors
const levelColors = [
  'var(--accent-green)',
  'var(--accent-green-light)',
  'var(--accent-amber)',
  '#6B7280',
  '#9CA3AF',
];

// Tree node component
function TreeNode({
  node,
  level = 0,
  path = '',
  onSelectQuestoes,
}: {
  node: IncidenciaNode;
  level?: number;
  path?: string;
  onSelectQuestoes: (questoes: Questao[]) => void;
}) {
  const expandedNodes = useAppStore((state) => state.expandedNodes);
  const toggleNodeExpanded = useAppStore((state) => state.toggleNodeExpanded);

  const currentPath = path ? `${path} > ${node.nome}` : node.nome;
  const isExpanded = expandedNodes.has(currentPath);
  const hasChildren = node.children && node.children.length > 0;

  const levelIcons = [IconBookOpen, IconFileText, IconTarget, IconChart, IconCheck];
  const LevelIcon = levelIcons[level] || IconCheck;

  return (
    <div className="select-none">
      <motion.div
        initial={false}
        animate={{ backgroundColor: isExpanded ? 'var(--bg-subtle)' : 'transparent' }}
        className={`
          flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer
          hover:bg-[var(--bg-subtle)] transition-colors group
        `}
        style={{ paddingLeft: `${level * 20 + 16}px` }}
        onClick={() => {
          if (hasChildren) {
            toggleNodeExpanded(currentPath);
          } else if (node.questoes && node.questoes.length > 0) {
            onSelectQuestoes(node.questoes);
          }
        }}
      >
        {/* Expand indicator */}
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          className="w-4 flex items-center justify-center"
        >
          {hasChildren && (
            <IconChevronRight size={14} className="text-[var(--text-muted)]" />
          )}
        </motion.div>

        {/* Icon */}
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${levelColors[level]}15` }}
        >
          <LevelIcon size={14} style={{ color: levelColors[level] }} />
        </div>

        {/* Name */}
        <span
          className={`flex-1 text-[13px] ${
            level === 0
              ? 'font-semibold text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)]'
          }`}
        >
          {node.nome}
        </span>

        {/* Stats */}
        <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
          <span className="text-[12px] text-[var(--text-tertiary)] text-mono">
            {node.count} {node.count === 1 ? 'questão' : 'questões'}
          </span>
          <div className="w-20 h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(node.percentual, 100)}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="h-full rounded-full"
              style={{ backgroundColor: levelColors[level] }}
            />
          </div>
          <span className="text-[11px] text-[var(--text-muted)] text-mono w-10 text-right">
            {node.percentual.toFixed(1)}%
          </span>
        </div>
      </motion.div>

      {/* Children */}
      <motion.div
        initial={false}
        animate={{
          height: isExpanded ? 'auto' : 0,
          opacity: isExpanded ? 1 : 0,
        }}
        transition={{ duration: 0.2 }}
        style={{ overflow: 'hidden' }}
      >
        {hasChildren &&
          node.children!.map((child, idx) => (
            <TreeNode
              key={`${currentPath}-${child.nome}-${idx}`}
              node={child}
              level={level + 1}
              path={currentPath}
              onSelectQuestoes={onSelectQuestoes}
            />
          ))}
      </motion.div>
    </div>
  );
}

export function Dashboard() {
  const activeEdital = useAppStore((state) => state.activeEdital);
  const questoes = useAppStore((state) => state.questoes);
  const incidencia = useAppStore((state) => state.incidencia);
  const setModoCanvas = useAppStore((state) => state.setModoCanvas);
  const setPainelDireito = useAppStore((state) => state.setPainelDireito);
  const setActiveEdital = useAppStore((state) => state.setActiveEdital);

  if (!activeEdital) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mb-4">
          <IconFileText size={32} className="text-[var(--text-muted)]" />
        </div>
        <p className="text-[var(--text-tertiary)]">Nenhum edital selecionado</p>
      </div>
    );
  }

  const totalQuestoes = questoes.length;
  const totalAnuladas = questoes.filter((q) => q.anulada).length;
  const totalRegulares = totalQuestoes - totalAnuladas;

  // Group by year
  const questoesPorAno = questoes.reduce(
    (acc, q) => {
      acc[q.ano] = (acc[q.ano] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>
  );

  const handleSelectQuestoes = (questoesNode: Questao[]) => {
    if (questoesNode.length > 0) {
      setPainelDireito(true, questoesNode[0] as Questao);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setActiveEdital(null)}
              className="btn btn-secondary btn-sm"
            >
              <IconArrowLeft size={16} />
              Voltar
            </button>
            <span className="badge badge-green">
              <IconCheck size={12} />
              Edital Ativo
            </span>
          </div>
          <h1
            className="text-[24px] font-semibold text-[var(--text-primary)] mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {activeEdital.nome}
          </h1>
          <div className="flex items-center gap-4 text-[13px] text-[var(--text-secondary)]">
            {activeEdital.banca && (
              <span className="flex items-center gap-1.5">
                <IconBuilding size={14} className="text-[var(--text-muted)]" />
                {activeEdital.banca}
              </span>
            )}
            {activeEdital.ano && (
              <span className="flex items-center gap-1.5">
                <IconCalendar size={14} className="text-[var(--text-muted)]" />
                {activeEdital.ano}
              </span>
            )}
            {activeEdital.orgao && (
              <span className="flex items-center gap-1.5">
                <IconUsers size={14} className="text-[var(--text-muted)]" />
                {activeEdital.orgao}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setModoCanvas('laboratorio')}
          className="btn btn-primary"
        >
          <IconFlask size={16} />
          Explorar Dados
        </button>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={IconBookOpen}
          value={totalQuestoes}
          label="Questões Extraídas"
          delay={0.1}
        />
        <StatCard
          icon={IconCheck}
          value={totalRegulares}
          label="Questões Válidas"
          variant="success"
          delay={0.15}
        />
        <StatCard
          icon={totalAnuladas > 0 ? IconX : IconCheck}
          value={totalAnuladas}
          label="Anuladas"
          variant={totalAnuladas > 0 ? 'warning' : 'default'}
          delay={0.2}
        />
        <StatCard
          icon={IconFileText}
          value={activeEdital.total_provas || 0}
          label="Provas Analisadas"
          delay={0.25}
        />
      </div>

      {/* Years Distribution */}
      {Object.keys(questoesPorAno).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-4">
            Distribuição por Ano
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(questoesPorAno)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([ano, count]) => (
                <YearBadge key={ano} year={Number(ano)} count={count} />
              ))}
          </div>
        </motion.div>
      )}

      {/* Incidence Tree */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="card p-6"
      >
        <div className="mb-5">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
            Análise de Incidência por Assunto
          </h2>
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Clique para expandir: Disciplina → Assunto → Tópico → Subtópico → Conceito
          </p>
        </div>

        {incidencia.length > 0 ? (
          <div className="space-y-1 -mx-2">
            {incidencia.map((node, idx) => (
              <TreeNode
                key={`${node.nome}-${idx}`}
                node={node}
                onSelectQuestoes={handleSelectQuestoes}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-4">
              <IconChart size={28} className="text-[var(--text-muted)]" />
            </div>
            <p className="text-[var(--text-tertiary)] mb-1">
              Ainda não há dados de incidência calculados.
            </p>
            <p className="text-[12px] text-[var(--text-muted)]">
              As questões precisam ser classificadas pelo sistema de IA para gerar a análise.
            </p>
          </div>
        )}
      </motion.div>

      {/* Alerts */}
      {totalAnuladas > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-6 border-l-4 border-l-[var(--accent-amber)]"
        >
          <h2 className="text-[15px] font-semibold text-[var(--accent-amber)] mb-3 flex items-center gap-2">
            <IconAlertTriangle size={18} />
            Alertas
          </h2>
          <div className="p-4 rounded-xl bg-[var(--accent-amber)] bg-opacity-5">
            <p className="text-[13px] text-[var(--text-secondary)]">
              {totalAnuladas} questão(ões) anulada(s) detectada(s) neste edital. Estas questões não
              devem ser consideradas no seu estudo.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
