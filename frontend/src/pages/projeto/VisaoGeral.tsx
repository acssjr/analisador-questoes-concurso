// frontend/src/pages/projeto/VisaoGeral.tsx
import { useOutletContext } from 'react-router';
import { useEffect, useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  HelpCircle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Loader2,
  AlertCircle,
  FolderTree,
} from 'lucide-react';
import { api } from '../../services/api';

interface ProjetoContext {
  projeto: {
    id: string;
    nome: string;
    total_provas: number;
    total_questoes: number;
    status: string;
  };
}

interface TaxonomiaNode {
  id: string;
  nome: string;
  count: number;
  children: TaxonomiaNode[];
}

// Status config with colors
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  rascunho: { label: 'Rascunho', color: 'var(--text-muted)', bgColor: 'var(--bg-muted)' },
  configurando: { label: 'Configurando', color: 'var(--text-muted)', bgColor: 'var(--bg-muted)' },
  coletando: { label: 'Coletando', color: 'var(--accent-amber)', bgColor: 'var(--status-warning-bg)' },
  analisando: { label: 'Analisando', color: 'var(--status-info)', bgColor: 'var(--status-info-bg)' },
  concluido: { label: 'Concluído', color: 'var(--status-success)', bgColor: 'var(--status-success-bg)' },
};

// Memoized stat card
const StatCard = memo(function StatCard({
  icon: Icon,
  value,
  label,
  trend,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  value: string | number;
  label: string;
  trend?: { label: string; color: string; bgColor: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-xl p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
          <Icon size={20} className="text-[var(--accent-green)]" />
        </div>
        <span className="text-[13px] text-gray-500">{label}</span>
      </div>
      {trend ? (
        <span
          className="text-[14px] font-medium px-2.5 py-1 rounded-full"
          style={{ backgroundColor: trend.bgColor, color: trend.color }}
        >
          {trend.label}
        </span>
      ) : (
        <p className="text-[28px] font-semibold text-gray-900">{value}</p>
      )}
    </motion.div>
  );
});

// Taxonomy tree node component
const TaxonomyTreeNode = memo(function TaxonomyTreeNode({
  node,
  level = 0,
  totalQuestions,
}: {
  node: TaxonomiaNode;
  level?: number;
  totalQuestions: number;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 1); // Auto-expand first level
  const hasChildren = node.children && node.children.length > 0;
  const percentage = totalQuestions > 0 ? ((node.count / totalQuestions) * 100).toFixed(1) : '0';

  const toggleExpand = useCallback(() => {
    if (hasChildren) setIsExpanded((prev) => !prev);
  }, [hasChildren]);

  // Color intensity based on percentage
  const getBarColor = useCallback(() => {
    const pct = parseFloat(percentage);
    if (pct >= 20) return 'var(--accent-green)';
    if (pct >= 10) return 'var(--accent-green-light)';
    if (pct >= 5) return 'var(--accent-green-lighter)';
    return 'var(--border-default)';
  }, [percentage]);

  return (
    <div className="taxonomy-tree">
      <button
        onClick={toggleExpand}
        className={`taxonomy-item-button w-full ${!hasChildren ? 'cursor-default' : ''}`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        {/* Expand/collapse icon */}
        <span className={`taxonomy-chevron ${hasChildren ? '' : 'invisible'}`}>
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>

        {/* Node info */}
        <div className="flex-1 flex items-center justify-between gap-4">
          <span className={`text-[14px] ${level === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
            {node.nome}
          </span>

          <div className="flex items-center gap-3">
            {/* Progress bar */}
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(parseFloat(percentage), 100)}%`,
                  backgroundColor: getBarColor(),
                }}
              />
            </div>

            {/* Count badge */}
            <span className="taxonomy-count min-w-[60px] text-right">
              {node.count} ({percentage}%)
            </span>
          </div>
        </div>
      </button>

      {/* Children */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="taxonomy-children"
          >
            {node.children.map((child) => (
              <TaxonomyTreeNode
                key={child.id || child.nome}
                node={child}
                level={level + 1}
                totalQuestions={totalQuestions}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default function VisaoGeral() {
  const { projeto } = useOutletContext<ProjetoContext>();
  const [taxonomia, setTaxonomia] = useState<TaxonomiaNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalQuestoes, setTotalQuestoes] = useState(0);
  const [hasTaxonomia, setHasTaxonomia] = useState(false);

  useEffect(() => {
    async function loadTaxonomia() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getProjetoTaxonomiaIncidencia(projeto.id);
        setHasTaxonomia(data.has_taxonomia);
        setTotalQuestoes(data.total_questoes);
        setTaxonomia(data.incidencia as TaxonomiaNode[]);
      } catch (err) {
        console.error('Erro ao carregar taxonomia:', err);
        setError('Não foi possível carregar a taxonomia do projeto');
      } finally {
        setLoading(false);
      }
    }
    loadTaxonomia();
  }, [projeto.id]);

  const status = statusConfig[projeto.status] || statusConfig.rascunho;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={FileText}
          value={projeto.total_provas}
          label="Provas"
        />
        <StatCard
          icon={HelpCircle}
          value={projeto.total_questoes}
          label="Questões"
        />
        <StatCard
          icon={CheckCircle2}
          value=""
          label="Status"
          trend={status}
        />
      </div>

      {/* Taxonomy section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white border border-gray-200 rounded-xl overflow-hidden"
      >
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FolderTree size={20} className="text-[var(--accent-green)]" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-gray-900">
                Taxonomia do Edital
              </h3>
              <p className="text-[13px] text-gray-500">
                Incidência de questões por disciplina e tópico
              </p>
            </div>
          </div>
          {totalQuestoes > 0 && (
            <span className="text-[13px] text-gray-500">
              Total: <span className="font-medium text-gray-900">{totalQuestoes}</span> questões
            </span>
          )}
        </div>

        <div className="p-5">
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="text-[var(--accent-green)] animate-spin" />
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-lg">
              <AlertCircle size={20} className="text-red-500" />
              <p className="text-[14px] text-red-700">{error}</p>
            </div>
          )}

          {/* No taxonomy */}
          {!loading && !error && !hasTaxonomia && (
            <div className="text-center py-10">
              <BookOpen size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-[14px] text-gray-500 mb-2">
                Nenhuma taxonomia configurada
              </p>
              <p className="text-[13px] text-gray-400">
                Importe um edital com conteúdo programático para ver a análise de incidência
              </p>
            </div>
          )}

          {/* Empty taxonomy (no questions yet) */}
          {!loading && !error && hasTaxonomia && taxonomia.length === 0 && (
            <div className="text-center py-10">
              <HelpCircle size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-[14px] text-gray-500 mb-2">
                Nenhuma questão classificada ainda
              </p>
              <p className="text-[13px] text-gray-400">
                Importe provas para ver a incidência por tópico
              </p>
            </div>
          )}

          {/* Taxonomy tree */}
          {!loading && !error && taxonomia.length > 0 && (
            <div className="space-y-1">
              {taxonomia.map((node) => (
                <TaxonomyTreeNode
                  key={node.id || node.nome}
                  node={node}
                  totalQuestions={totalQuestoes}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
