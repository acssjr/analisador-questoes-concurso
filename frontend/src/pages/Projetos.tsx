import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Plus, Trash2, ChevronRight, Upload, Search } from 'lucide-react';
import { ProjetoWorkflowModal } from '../components/features/ProjetoWorkflowModal';
import { api } from '../services/api';
import type { Projeto } from '../types';

// Status labels with colors
const statusLabels: Record<string, { label: string; color: string }> = {
  configurando: { label: 'Configurando', color: 'var(--text-muted)' },
  coletando: { label: 'Coletando', color: 'var(--accent-amber)' },
  analisando: { label: 'Analisando', color: 'var(--status-info)' },
  concluido: { label: 'Concluido', color: 'var(--status-success)' },
};

// Memoized project card component
const ProjectCard = memo(function ProjectCard({
  projeto,
  index,
  onNavigate,
  onDelete,
}: {
  projeto: Projeto;
  index: number;
  onNavigate: (projeto: Projeto) => void;
  onDelete: (e: React.MouseEvent, projeto: Projeto) => void;
}) {
  const status = statusLabels[projeto.status] || statusLabels.configurando;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      onClick={() => onNavigate(projeto)}
      className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <FolderOpen size={20} className="text-[var(--accent-green)]" />
          </div>
          <h3 className="text-[15px] font-semibold text-gray-900 group-hover:text-[var(--accent-green)] transition-colors">
            {projeto.nome}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => onDelete(e, projeto)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
          <ChevronRight size={18} className="text-gray-400 group-hover:text-[var(--accent-green)] transition-colors" />
        </div>
      </div>

      <p className="text-[13px] text-gray-500 mb-4">
        {projeto.banca && `${projeto.banca} `}
        {projeto.ano && `• ${projeto.ano} `}
        {projeto.cargo && `• ${projeto.cargo}`}
        {!projeto.banca && !projeto.ano && !projeto.cargo && 'Sem metadados'}
      </p>

      <div className="flex items-center gap-4 text-[12px]">
        <span className="text-gray-500">
          <span className="text-gray-900 font-medium">{projeto.total_provas}</span> provas
        </span>
        <span className="text-gray-500">
          <span className="text-gray-900 font-medium">{projeto.total_questoes}</span> questões
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span
          className="text-[11px] px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${status.color} 15%, transparent)`,
            color: status.color,
          }}
        >
          {status.label}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate({ ...projeto, navigateTo: 'provas' } as Projeto & { navigateTo: string });
          }}
          className="flex items-center gap-1 text-[11px] text-[var(--accent-green)] hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Upload size={12} />
          Importar Provas
        </button>
      </div>
    </motion.div>
  );
});

export default function Projetos() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const response = await api.listProjetos();
        setProjetos(response.projetos || []);
      } catch (err) {
        console.error('Erro ao carregar projetos:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function handleNavigate(projeto: Projeto & { navigateTo?: string }) {
    const path = projeto.navigateTo
      ? `/projeto/${projeto.id}/${projeto.navigateTo}`
      : `/projeto/${projeto.id}`;
    navigate(path);
  }

  async function handleDelete(e: React.MouseEvent, projeto: Projeto) {
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

  const filteredProjetos = projetos.filter((p) =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-semibold text-gray-900">Projetos</h1>
          <p className="text-[14px] text-gray-500 mt-1">
            Gerencie seus projetos de análise de questões
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Novo Projeto
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar projetos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md pl-10 pr-4 py-2 text-[14px] bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-green)] focus:ring-opacity-20 focus:border-[var(--accent-green)]"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gray-200" />
                <div className="h-5 bg-gray-200 rounded w-32" />
              </div>
              <div className="h-4 bg-gray-200 rounded w-48 mb-4" />
              <div className="h-4 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && projetos.length === 0 && (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <FolderOpen size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-[16px] font-medium text-gray-900 mb-2">
            Nenhum projeto ainda
          </h3>
          <p className="text-[14px] text-gray-500 mb-6">
            Crie seu primeiro projeto para começar a análise
          </p>
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            Criar Projeto
          </button>
        </div>
      )}

      {/* Projects grid */}
      {!loading && filteredProjetos.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filteredProjetos.map((projeto, index) => (
              <ProjectCard
                key={projeto.id}
                projeto={projeto}
                index={index}
                onNavigate={handleNavigate}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* No results */}
      {!loading && projetos.length > 0 && filteredProjetos.length === 0 && (
        <div className="text-center py-12">
          <Search size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-[14px] text-gray-500">
            Nenhum projeto encontrado para "{searchTerm}"
          </p>
        </div>
      )}

      {/* Modal */}
      <ProjetoWorkflowModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUploadSuccess={() => {
          setIsModalOpen(false);
          // Reload projects
          api.listProjetos().then((res) => setProjetos(res.projetos || []));
        }}
      />
    </div>
  );
}
