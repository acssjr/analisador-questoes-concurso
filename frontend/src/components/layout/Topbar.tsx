import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/appStore';
import { EditalWorkflowModal } from '../features/EditalWorkflowModal';
import { useNotifications } from '../../hooks/useNotifications';
import {
  IconBell,
  IconSettings,
  IconPlus,
  IconCheck,
} from '../ui/Icons';

export function Topbar() {
  const activeEdital = useAppStore((state) => state.activeEdital);
  const filtros = useAppStore((state) => state.filtros);
  const questoes = useAppStore((state) => state.questoes);
  const notifications = useNotifications((state) => state.notifications);
  const addNotification = useNotifications((state) => state.addNotification);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const handleUploadSuccess = () => {
    addNotification({
      type: 'success',
      title: 'Upload concluído!',
      message: 'Suas questões foram processadas com sucesso',
    });
  };

  const statusOptions = [
    { value: 'todas', label: 'Todas' },
    { value: 'regulares', label: 'Válidas' },
    { value: 'anuladas', label: 'Anuladas' },
  ] as const;

  return (
    <header className="h-16 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] px-6 flex items-center justify-between flex-shrink-0">
      {/* Left: Logo & Branding */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          {/* Logo Mark */}
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-green)] flex items-center justify-center shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          {/* Brand Name */}
          <div>
            <h1 className="text-[15px] font-semibold text-[var(--text-primary)] tracking-tight">
              Questões
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] -mt-0.5">
              Analisador de Provas
            </p>
          </div>
        </div>

        {/* Active Edital Badge */}
        {activeEdital && (
          <div className="flex items-center gap-2 pl-6 border-l border-[var(--border-subtle)]">
            <span className="badge badge-green">
              <IconCheck size={12} />
              {activeEdital.nome}
            </span>
          </div>
        )}
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar questões, disciplinas..."
            className={`
              input input-search w-full transition-all duration-200
              ${searchFocused ? 'ring-2 ring-[var(--accent-green)] ring-opacity-20' : ''}
            `}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-muted)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded">
            ⌘K
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Status Filter Pills */}
        {questoes.length > 0 && (
          <div className="flex items-center gap-1 mr-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => useAppStore.getState().setFiltros({ status: option.value })}
                className={`
                  px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200
                  ${filtros.status === option.value
                    ? 'bg-[var(--accent-green)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {/* Import Button */}
        <button
          onClick={() => setUploadModalOpen(true)}
          className="btn btn-primary btn-sm"
        >
          <IconPlus size={16} />
          Importar
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="btn btn-ghost btn-icon relative"
          >
            <IconBell size={20} />
            {notifications.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--accent-amber)] text-white text-[10px] font-bold flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifDropdownOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setNotifDropdownOpen(false)}
                />

                {/* Dropdown */}
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-80 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
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

                  <div className="max-h-80 overflow-y-auto scrollbar-custom">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-3">
                          <IconBell size={24} className="text-[var(--text-muted)]" />
                        </div>
                        <p className="text-[13px] text-[var(--text-tertiary)]">
                          Nenhuma notificação
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--border-subtle)]">
                        {notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className="p-4 hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                          >
                            <p className="text-[13px] font-medium text-[var(--text-primary)] mb-0.5">
                              {notif.title}
                            </p>
                            {notif.message && (
                              <p className="text-[12px] text-[var(--text-tertiary)]">
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

        {/* Settings */}
        <button className="btn btn-ghost btn-icon">
          <IconSettings size={20} />
        </button>

        {/* User Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent-green)] to-[var(--accent-green-light)] flex items-center justify-center text-white text-[13px] font-semibold ml-1">
          U
        </div>
      </div>

      {/* Upload Modal */}
      <EditalWorkflowModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </header>
  );
}
