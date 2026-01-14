// frontend/src/pages/projeto/ProvasQuestoes.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router';
import { UploadDropzone } from '../../components/features/UploadDropzone';
import { QueueVisualization, type QueueItem } from '../../components/features/QueueVisualization';
import { QueueSummary } from '../../components/features/QueueSummary';
import { useNotifications } from '../../hooks/useNotifications';
import { api } from '../../services/api';

interface ProjetoContext {
  projeto: { id: string };
}

// Polling interval in milliseconds
const QUEUE_POLL_INTERVAL = 3000;

export default function ProvasQuestoes() {
  const { projeto } = useOutletContext<ProjetoContext>();
  const addNotification = useNotifications(state => state.addNotification);

  // Queue state
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Ref to track polling interval
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if there are items that need polling (pending, validating, processing, retry)
  const hasActiveItems = useCallback((items: QueueItem[]) => {
    return items.some(item =>
      item.queue_status === 'pending' ||
      item.queue_status === 'validating' ||
      item.queue_status === 'processing' ||
      item.queue_status === 'retry'
    );
  }, []);

  // Fetch queue status from API
  const fetchQueueStatus = useCallback(async () => {
    try {
      const response = await api.getProvaQueueStatus(projeto.id);
      setQueueItems(response.items);
      return response.items;
    } catch (error) {
      console.error('Error fetching queue status:', error);
      // Don't show notification for polling errors to avoid spam
      // Return empty array on error - component displays existing queueItems from state
      return [];
    }
  }, [projeto.id]);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return; // Already polling

    setIsPolling(true);
    pollingIntervalRef.current = setInterval(async () => {
      const items = await fetchQueueStatus();
      if (!hasActiveItems(items)) {
        // Stop polling when no active items
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsPolling(false);
      }
    }, QUEUE_POLL_INTERVAL);
  }, [fetchQueueStatus, hasActiveItems]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    const initializeQueue = async () => {
      const items = await fetchQueueStatus();
      if (hasActiveItems(items)) {
        startPolling();
      }
    };

    initializeQueue();

    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [projeto.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle file upload
  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);

    try {
      const response = await api.uploadProvasProjeto(projeto.id, files);

      if (response.success) {
        addNotification({
          type: 'success',
          title: 'Upload concluido',
          message: `${response.successful_files} de ${response.total_files} arquivo(s) enviado(s) com sucesso`,
        });

        // Refresh queue status immediately
        const items = await fetchQueueStatus();

        // Start polling if there are active items
        if (hasActiveItems(items)) {
          startPolling();
        }
      } else {
        addNotification({
          type: 'error',
          title: 'Erro no upload',
          message: `${response.failed_files} arquivo(s) falharam no upload`,
        });
      }

      // Show individual file errors
      response.results.filter(r => !r.success).forEach(result => {
        addNotification({
          type: 'error',
          title: `Falha: ${result.filename}`,
          message: result.error || 'Erro desconhecido',
        });
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Erro no upload',
        message: error instanceof Error ? error.message : 'Erro ao enviar arquivos',
      });
    } finally {
      setIsUploading(false);
    }
  }, [projeto.id, addNotification, fetchQueueStatus, hasActiveItems, startPolling]);

  // Handle retry action
  const handleRetry = useCallback(async (id: string) => {
    try {
      await api.retryProvaProcessing(id);
      addNotification({
        type: 'info',
        title: 'Reprocessando',
        message: 'A prova sera reprocessada em breve',
      });

      // Refresh queue and start polling
      await fetchQueueStatus();
      startPolling();
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Erro ao reprocessar',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }, [addNotification, fetchQueueStatus, startPolling]);

  // Handle cancel action
  const handleCancel = useCallback(async (id: string) => {
    try {
      await api.cancelProvaProcessing(id);
      addNotification({
        type: 'info',
        title: 'Cancelado',
        message: 'O processamento foi cancelado',
      });

      // Refresh queue status
      await fetchQueueStatus();
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Erro ao cancelar',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }, [addNotification, fetchQueueStatus]);

  // Handle retry all failed items
  const handleRetryAll = useCallback(async () => {
    const failedItems = queueItems.filter(item => item.queue_status === 'failed');
    for (const item of failedItems) {
      await handleRetry(item.id);
    }
  }, [queueItems, handleRetry]);

  // Handle cancel all pending/processing items
  const handleCancelAll = useCallback(async () => {
    const activeItems = queueItems.filter(item =>
      item.queue_status === 'pending' ||
      item.queue_status === 'validating' ||
      item.queue_status === 'processing'
    );
    for (const item of activeItems) {
      await handleCancel(item.id);
    }
  }, [queueItems, handleCancel]);

  return (
    <div className="space-y-6" data-projeto-id={projeto.id}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Provas & Questoes</h2>
        {isPolling && (
          <span className="text-xs text-blue-400 animate-pulse">
            Atualizando...
          </span>
        )}
      </div>

      {/* Upload dropzone */}
      <UploadDropzone
        onFilesSelected={handleFilesSelected}
        disabled={isUploading}
        data-testid="provas-upload-dropzone"
      />

      {/* Queue Summary */}
      <QueueSummary
        items={queueItems}
        onRetryAll={handleRetryAll}
        onCancelAll={handleCancelAll}
      />

      {/* Queue Visualization */}
      <div>
        <h3 className="text-md font-medium text-white mb-4">Fila de Processamento</h3>
        <QueueVisualization
          items={queueItems}
          onRetry={handleRetry}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
