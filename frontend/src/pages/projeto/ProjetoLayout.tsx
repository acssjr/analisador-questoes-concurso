// frontend/src/pages/projeto/ProjetoLayout.tsx
import { Outlet, NavLink, useParams, useNavigate } from 'react-router';
import { useEffect, useState, memo } from 'react';
import { ChevronLeft, LayoutDashboard, FileText, BarChart3, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { Projeto } from '../../types';

interface TabConfig {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

// Memoized tab navigation
const TabNav = memo(function TabNav({
  tabs,
  projectId,
}: {
  tabs: TabConfig[];
  projectId: string;
}) {
  return (
    <nav className="flex gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.path}
            to={`/projeto/${projectId}/${tab.path}`}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                isActive
                  ? 'bg-[var(--accent-green)] text-white shadow-sm'
                  : 'text-gray-600 hover:text-[var(--accent-green)] hover:bg-emerald-50'
              }`
            }
          >
            <Icon size={16} />
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
});

export default function ProjetoLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjeto() {
      if (!id) return;
      try {
        const data = await api.getProjeto(id);
        setProjeto(data);
      } catch (error) {
        console.error('Failed to load projeto:', error);
      } finally {
        setLoading(false);
      }
    }
    loadProjeto();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <Loader2 size={32} className="text-[var(--accent-green)] animate-spin" />
      </div>
    );
  }

  if (!projeto || !id) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="text-center">
          <FileText size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-[15px]">Projeto não encontrado</p>
          <button
            onClick={() => navigate('/projetos')}
            className="mt-4 btn btn-secondary btn-sm"
          >
            Voltar para Projetos
          </button>
        </div>
      </div>
    );
  }

  const tabs: TabConfig[] = [
    { path: 'visao-geral', label: 'Visão Geral', icon: LayoutDashboard },
    { path: 'provas', label: 'Provas & Questões', icon: FileText },
    { path: 'analise', label: 'Análise Profunda', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-5">
          {/* Back button + title */}
          <div className="flex items-center gap-4 mb-5">
            <button
              onClick={() => navigate('/projetos')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-[var(--accent-green)]"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-[20px] font-semibold text-gray-900">{projeto.nome}</h1>
              <p className="text-[13px] text-gray-500">
                {projeto.banca && `${projeto.banca} `}
                {projeto.ano && `• ${projeto.ano} `}
                {projeto.cargo && `• ${projeto.cargo}`}
                {!projeto.banca && !projeto.ano && !projeto.cargo && 'Projeto de análise'}
              </p>
            </div>
          </div>

          {/* Tab navigation */}
          <TabNav tabs={tabs} projectId={id!} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Outlet context={{ projeto, refreshProjeto: () => api.getProjeto(id!).then(setProjeto) }} />
      </div>
    </div>
  );
}
