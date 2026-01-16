import { memo, Suspense, useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { GlobalSidebar } from './GlobalSidebar';
import { GlobalNavbar } from './GlobalNavbar';
import { ProjetoWorkflowModal } from '../features/ProjetoWorkflowModal';
import { api } from '../../services/api';

// Skeleton loader for page transitions
const PageSkeleton = memo(function PageSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-6" />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="h-24 bg-gray-200 rounded" />
        <div className="h-24 bg-gray-200 rounded" />
        <div className="h-24 bg-gray-200 rounded" />
      </div>
      <div className="h-64 bg-gray-200 rounded" />
    </div>
  );
});

export const AppLayout = memo(function AppLayout() {
  const navigate = useNavigate();
  const [totalProjetos, setTotalProjetos] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await api.listProjetos();
        setTotalProjetos(response.projetos?.length || 0);
      } catch {
        // Silently fail - stats are not critical
      }
    }
    fetchStats();
  }, [refreshKey]);

  const handleNewProject = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleUploadSuccess = useCallback(() => {
    setIsModalOpen(false);
    setRefreshKey((k) => k + 1);
    // Optionally navigate to the projects page
    navigate('/projetos');
  }, [navigate]);

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)]">
      {/* Top Navbar */}
      <GlobalNavbar onNewProject={handleNewProject} />

      {/* Main Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar */}
        <GlobalSidebar totalProjetos={totalProjetos} />

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-custom">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Global New Project Modal */}
      <ProjetoWorkflowModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
});

export default AppLayout;
