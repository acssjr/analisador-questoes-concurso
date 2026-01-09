import type { ReactNode } from 'react';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { AnalysisPanel } from '../features/AnalysisPanel';
import { useAppStore } from '../../store/appStore';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const painelDireitoAberto = useAppStore(state => state.painelDireitoAberto);

  return (
    <div className="h-full flex flex-col">
      {/* Barra Superior */}
      <Topbar />

      {/* Layout de 3 colunas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Esquerda */}
        <Sidebar />

        {/* Canvas Central */}
        <main className="flex-1 overflow-auto bg-dark-bg p-6">
          {children}
        </main>

        {/* Painel Direito (Análise de Questão) */}
        {painelDireitoAberto && <AnalysisPanel />}
      </div>
    </div>
  );
}
