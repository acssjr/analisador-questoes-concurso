import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';
import type { Edital } from '../../types';
import {
  IconBookOpen,
  IconTarget,
  IconArrowRight,
  IconTrash,
  IconFolder,
} from '../ui/Icons';

interface EditaisListProps {
  onSelectEdital: (edital: Edital) => void;
  onNewEdital: () => void;
}

export function EditaisList({ onSelectEdital, onNewEdital }: EditaisListProps) {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEditais();
  }, []);

  async function loadEditais() {
    try {
      setLoading(true);
      setError(null);
      const response = await api.listEditais();
      setEditais(response);
    } catch (err) {
      console.error('Erro ao carregar editais:', err);
      setError('Não foi possível carregar os editais');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, edital: Edital) {
    e.stopPropagation();
    if (!confirm(`Tem certeza que deseja excluir "${edital.nome}"?`)) return;

    try {
      // TODO: implement delete API
      // await api.deleteEdital(edital.id);
      setEditais(prev => prev.filter(e => e.id !== edital.id));
    } catch (err) {
      console.error('Erro ao excluir edital:', err);
      alert('Erro ao excluir edital');
    }
  }

  // Count items in taxonomy
  function countTaxonomyItems(taxonomia: any): { disciplinas: number; itens: number } {
    if (!taxonomia?.disciplinas) return { disciplinas: 0, itens: 0 };

    const disciplinas = taxonomia.disciplinas.length;
    let itens = 0;

    function countItems(items: any[]): number {
      if (!items) return 0;
      let count = items.length;
      for (const item of items) {
        if (item.itens) count += countItems(item.itens);
        if (item.filhos) count += countItems(item.filhos);
      }
      return count;
    }

    for (const disc of taxonomia.disciplinas) {
      if (disc.itens) itens += countItems(disc.itens);
      if (disc.assuntos) itens += disc.assuntos.length;
    }

    return { disciplinas, itens };
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
        <button onClick={loadEditais} className="btn btn-secondary">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (editais.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-[rgba(27,67,50,0.1)] flex items-center justify-center mx-auto mb-4">
          <IconFolder size={32} className="text-[var(--accent-green)]" />
        </div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Nenhum edital cadastrado
        </h3>
        <p className="text-[14px] text-[var(--text-secondary)] mb-4">
          Comece importando o edital do seu concurso
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewEdital}
          className="btn btn-primary"
        >
          Importar Edital
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
          Editais Cadastrados
        </h2>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewEdital}
          className="btn btn-sm btn-secondary"
        >
          Novo Edital
        </motion.button>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {editais.map((edital, index) => {
            const { disciplinas, itens } = countTaxonomyItems(edital.taxonomia);
            const hasTaxonomia = disciplinas > 0;

            return (
              <motion.div
                key={edital.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ x: 4, backgroundColor: 'var(--bg-subtle)' }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelectEdital(edital)}
                className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-colors group border border-transparent hover:border-[var(--border-subtle)]"
              >
                {/* Icon */}
                <motion.div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    hasTaxonomia
                      ? 'bg-[rgba(27,67,50,0.1)]'
                      : 'bg-[var(--bg-muted)]'
                  }`}
                  whileHover={{ scale: 1.1 }}
                >
                  <IconBookOpen
                    size={24}
                    className={hasTaxonomia ? 'text-[var(--accent-green)]' : 'text-[var(--text-muted)]'}
                  />
                </motion.div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-green)] transition-colors">
                      {edital.nome}
                    </h3>
                    {hasTaxonomia ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(27,67,50,0.1)] text-[var(--accent-green)]">
                        Completo
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)]">
                        Sem conteúdo
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-[12px] text-[var(--text-secondary)]">
                    {edital.banca && <span>{edital.banca}</span>}
                    {edital.ano && <span>{edital.ano}</span>}
                    {edital.cargo && (
                      <span className="truncate max-w-[150px]">{edital.cargo}</span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 text-[12px] text-[var(--text-secondary)]">
                  <div className="flex items-center gap-1.5">
                    <IconTarget size={14} className="text-[var(--accent-green)]" />
                    <span>{disciplinas} disciplinas</span>
                  </div>
                  {itens > 0 && (
                    <div className="flex items-center gap-1.5">
                      <IconFolder size={14} className="text-[var(--accent-blue)]" />
                      <span>{itens} itens</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => handleDelete(e, edital)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Excluir edital"
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
