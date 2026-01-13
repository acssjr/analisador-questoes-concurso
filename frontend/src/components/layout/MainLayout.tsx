import type { ReactNode } from 'react';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { AnalysisPanel } from '../features/AnalysisPanel';
import { useAppStore } from '../../store/appStore';

interface MainLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

export function MainLayout({ children, showSidebar = true }: MainLayoutProps) {
  const painelDireitoAberto = useAppStore((state) => state.painelDireitoAberto);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Top Bar */}
      <Topbar />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        {showSidebar && <Sidebar />}

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6 scrollbar-custom">
          {children}
        </main>

        {/* Right Panel (Question Analysis) */}
        {painelDireitoAberto && <AnalysisPanel />}
      </div>
    </div>
  );
}
