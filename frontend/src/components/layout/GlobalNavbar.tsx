import { memo, useState } from 'react';
import { useLocation } from 'react-router';
import { Bell, Plus, Home, FolderOpen, Settings, User } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { AnimatePresence, motion } from 'framer-motion';

// Page config for titles and actions
const pageConfig: Record<string, { title: string; icon: React.ComponentType<{ size?: number; className?: string }>; action?: { label: string; path?: string } }> = {
  '/': { title: 'Dashboard', icon: Home, action: { label: 'Novo Projeto' } },
  '/projetos': { title: 'Projetos', icon: FolderOpen, action: { label: 'Novo Projeto' } },
  '/configuracoes': { title: 'Configurações', icon: Settings },
  '/perfil': { title: 'Perfil', icon: User },
};

interface GlobalNavbarProps {
  onNewProject?: () => void;
}

export const GlobalNavbar = memo(function GlobalNavbar({ onNewProject }: GlobalNavbarProps) {
  const location = useLocation();
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const notifications = useNotifications((state) => state.notifications);

  // Get current page config
  const currentPath = location.pathname;
  const config = pageConfig[currentPath] || pageConfig['/'];
  const PageIcon = config.icon;

  const handleAction = () => {
    if (onNewProject) {
      onNewProject();
    }
  };

  return (
    <header className="h-14 bg-gray-900 px-6 flex items-center justify-between flex-shrink-0">
      {/* Left: Page title with icon */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
          <PageIcon size={18} className="text-white" />
        </div>
        <h1 className="text-[15px] font-semibold text-white">
          {config.title}
        </h1>
      </div>

      {/* Right: Action + Notifications */}
      <div className="flex items-center gap-3">
        {/* Contextual Action Button */}
        {config.action && (
          <button
            onClick={handleAction}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-green)] hover:bg-emerald-600 text-white text-[13px] font-medium rounded-lg transition-colors"
          >
            <Plus size={16} />
            {config.action.label}
          </button>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors relative"
          >
            <Bell size={20} className="text-white/80" />
            {notifications.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setNotifDropdownOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-[14px] font-semibold text-gray-900">
                      Notificações
                    </h3>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => useNotifications.getState().clearAll()}
                        className="text-[12px] text-[var(--accent-green)] hover:underline font-medium"
                      >
                        Limpar tudo
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell size={24} className="text-gray-300 mx-auto mb-2" />
                        <p className="text-[13px] text-gray-400">
                          Nenhuma notificação
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <p className="text-[13px] font-medium text-gray-900 mb-0.5">
                              {notif.title}
                            </p>
                            {notif.message && (
                              <p className="text-[12px] text-gray-500">
                                {notif.message}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
});
