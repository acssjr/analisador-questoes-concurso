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
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)]">
      {/* Top Bar */}
      <Topbar />

      {/* Main Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar */}
        {showSidebar && <Sidebar />}

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-custom">
          {children}
        </main>

        {/* Right Panel (Question Analysis) */}
        {painelDireitoAberto && <AnalysisPanel />}
      </div>
    </div>
  );
}
