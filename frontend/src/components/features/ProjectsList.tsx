import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';
import type { Projeto } from '../../types';
import {
  IconBookOpen,
  IconTarget,
  IconChart,
  IconArrowRight,
  IconTrash,
} from '../ui/Icons';

interface ProjectsListProps {
  onSelectProject: (projeto: Projeto) => void;
  onNewProject: () => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  configurando: { label: 'Configurando', color: 'var(--text-muted)' },
  coletando: { label: 'Coletando', color: 'var(--accent-yellow)' },
  analisando: { label: 'Analisando', color: 'var(--accent-blue)' },
  concluido: { label: 'Concluído', color: 'var(--accent-green)' },
};

export function ProjectsList({ onSelectProject, onNewProject }: ProjectsListProps) {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjetos();
  }, []);

  async function loadProjetos() {
    try {
      setLoading(true);
      setError(null);
      const response = await api.listProjetos();
      setProjetos(response.projetos);
    } catch (err) {
      console.error('Erro ao carregar projetos:', err);
      setError('Não foi possível carregar os projetos');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, projeto: Projeto) {
    e.stopPropagation();
    if (!confirm(`Tem certeza que deseja excluir "${projeto.nome}"?`)) return;

    try {
      await api.deleteProjeto(projeto.id);
      setProjetos(prev => prev.filter(p => p.id !== projeto.id));
    } catch (err) {
      console.error('Erro ao excluir projeto:', err);
      alert('Erro ao excluir projeto');
    }
  }

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 rounded-xl bg-[var(--bg-muted)] mx-auto mb-4" />
          <div className="h-4 bg-[var(--bg-muted)] rounded w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-[var(--text-secondary)] mb-4">{error}</p>
        <button onClick={loadProjetos} className="btn btn-secondary">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (projetos.length === 0) {
    return null; // Let parent show empty state
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
          Seus Projetos
        </h2>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewProject}
          className="btn btn-sm btn-secondary"
        >
          Novo Projeto
        </motion.button>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {projetos.map((projeto, index) => {
            const status = statusLabels[projeto.status] || statusLabels.configurando;

            return (
              <motion.div
                key={projeto.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ x: 4, backgroundColor: 'var(--bg-subtle)' }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelectProject(projeto)}
                className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-colors group border border-transparent hover:border-[var(--border-subtle)]"
              >
                {/* Icon */}
                <motion.div
                  className="w-12 h-12 rounded-xl bg-[rgba(27,67,50,0.1)] flex items-center justify-center flex-shrink-0"
                  whileHover={{ scale: 1.1 }}
                >
                  <IconBookOpen size={24} className="text-[var(--accent-green)]" />
                </motion.div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-green)] transition-colors">
                      {projeto.nome}
                    </h3>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${status.color} 15%, transparent)`,
                        color: status.color,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-[12px] text-[var(--text-secondary)]">
                    {projeto.banca && (
                      <span>{projeto.banca}</span>
                    )}
                    {projeto.ano && (
                      <span>{projeto.ano}</span>
                    )}
                    {projeto.cargo && (
                      <span className="truncate max-w-[150px]">{projeto.cargo}</span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 text-[12px] text-[var(--text-secondary)]">
                  <div className="flex items-center gap-1.5">
                    <IconTarget size={14} className="text-[var(--accent-green)]" />
                    <span>{projeto.total_questoes_validas} questões</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconChart size={14} className="text-[var(--accent-blue)]" />
                    <span>{projeto.total_provas} provas</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => handleDelete(e, projeto)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Excluir projeto"
                  >
                    <IconTrash size={16} />
                  </motion.button>
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    className="text-[var(--accent-green)] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <IconArrowRight size={16} />
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
