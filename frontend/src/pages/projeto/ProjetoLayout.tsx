// frontend/src/pages/projeto/ProjetoLayout.tsx
import { Outlet, NavLink, useParams, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import { IconFileText, IconChart, IconFlask, IconChevronLeft } from '../../components/ui/Icons';
import { api } from '../../services/api';
import type { Projeto } from '../../types';

interface TabConfig {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

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
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </MainLayout>
    );
  }

  if (!projeto) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-400">Projeto não encontrado</p>
        </div>
      </MainLayout>
    );
  }

  const tabs: TabConfig[] = [
    { path: 'visao-geral', label: 'Visão Geral', icon: IconFileText },
    { path: 'provas', label: 'Provas & Questões', icon: IconFlask },
    { path: 'analise', label: 'Análise Profunda', icon: IconChart },
  ];

  return (
    <MainLayout showSidebar={false}>
      <div className="min-h-screen bg-gray-950">
        {/* Header */}
        <div className="border-b border-gray-800 bg-gray-900/50">
          <div className="max-w-7xl mx-auto px-4 py-4">
            {/* Back button + title */}
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400"
              >
                <IconChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-white">{projeto.nome}</h1>
                <p className="text-sm text-gray-400">
                  {projeto.banca && `${projeto.banca} `}
                  {projeto.ano && `• ${projeto.ano} `}
                  {projeto.cargo && `• ${projeto.cargo}`}
                </p>
              </div>
            </div>

            {/* Tab navigation */}
            <nav className="flex gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <NavLink
                    key={tab.path}
                    to={`/projeto/${id}/${tab.path}`}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`
                    }
                  >
                    <Icon size={16} />
                    {tab.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet context={{ projeto }} />
        </div>
      </div>
    </MainLayout>
  );
}
