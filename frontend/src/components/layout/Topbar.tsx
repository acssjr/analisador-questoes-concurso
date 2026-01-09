import { useState } from 'react';
import { Button, Badge } from '../ui';
import { useAppStore } from '../../store/appStore';
import { EditalWorkflowModal } from '../features/EditalWorkflowModal';
import { useNotifications } from '../../hooks/useNotifications';

export function Topbar() {
  const activeDataset = useAppStore(state => state.activeDataset);
  const filtros = useAppStore(state => state.filtros);
  const questoes = useAppStore(state => state.questoes);
  const setDatasets = useAppStore(state => state.setDatasets);
  const notifications = useNotifications(state => state.notifications);
  const addNotification = useNotifications(state => state.addNotification);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  const totalFiltradas = questoes.length; // Simplificado - deveria aplicar filtros

  const handleUploadSuccess = () => {
    addNotification({
      type: 'success',
      title: 'Upload concluído!',
      message: 'Suas questões foram processadas com sucesso',
    });
    // Recarregar datasets
    setDatasets([]);
  };

  return (
    <header className="h-16 surface border-b border-dark-border px-6 flex items-center justify-between flex-shrink-0">
      {/* Bloco 1: Logo e Contexto */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-text-primary">Analisador de Questões</h1>
        {activeDataset && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Dataset:</span>
            <Badge>{activeDataset.nome}</Badge>
            <Badge variant="info">{activeDataset.total_questoes} questões</Badge>
          </div>
        )}
      </div>

      {/* Bloco 2: Filtros Globais Rápidos */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Status:</span>
          <div className="flex gap-1">
            {(['todas', 'regulares', 'anuladas'] as const).map(status => (
              <button
                key={status}
                onClick={() => useAppStore.getState().setFiltros({ status })}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  filtros.status === status
                    ? 'bg-disciplinas-portugues bg-opacity-20 border-disciplinas-portugues text-disciplinas-portugues'
                    : 'border-dark-border text-text-secondary hover:border-text-secondary'
                }`}
              >
                {status === 'todas' ? 'Todas' : status === 'regulares' ? 'Regulares' : 'Anuladas'}
              </button>
            ))}
          </div>
        </div>
        <Badge variant="info" className="font-mono">
          {totalFiltradas} questões
        </Badge>
      </div>

      {/* Bloco 3: Ações Principais */}
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setUploadModalOpen(true)}>
          Importar PDFs
        </Button>
        <Button variant="ghost" size="sm">
          Exportar Relatório
        </Button>

        {/* Notificações */}
        <div className="relative">
          <button
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="p-2 hover:bg-white hover:bg-opacity-5 rounded transition-colors relative"
          >
            <span className="text-xl">🔔</span>
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 bg-semantic-error text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-mono">
                {notifications.length}
              </span>
            )}
          </button>

          {notifDropdownOpen && (
            <div className="absolute right-0 top-12 w-80 surface border border-dark-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
              <div className="p-3 border-b border-dark-border flex items-center justify-between">
                <h3 className="text-sm font-medium text-text-primary">Notificações</h3>
                {notifications.length > 0 && (
                  <button
                    onClick={() => useNotifications.getState().clearAll()}
                    className="text-xs text-semantic-info hover:underline"
                  >
                    Limpar tudo
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-text-secondary text-sm">
                  Nenhuma notificação
                </div>
              ) : (
                <div className="divide-y divide-dark-border">
                  {notifications.map(notif => (
                    <div key={notif.id} className="p-3 hover:bg-white hover:bg-opacity-5">
                      <p className="text-sm font-medium text-text-primary mb-1">{notif.title}</p>
                      {notif.message && (
                        <p className="text-xs text-text-secondary">{notif.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button className="p-2 hover:bg-white hover:bg-opacity-5 rounded transition-colors">
          <span className="text-xl">⚙️</span>
        </button>
      </div>

      {/* Edital Workflow Modal */}
      <EditalWorkflowModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </header>
  );
}
