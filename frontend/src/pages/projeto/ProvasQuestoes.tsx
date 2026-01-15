// frontend/src/pages/projeto/ProvasQuestoes.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router';
import { UploadDropzone } from '../../components/features/UploadDropzone';
import { QueueVisualization, type QueueItem } from '../../components/features/QueueVisualization';
import { QueueSummary } from '../../components/features/QueueSummary';
import { TaxonomyTree, type TaxonomyNode } from '../../components/features/TaxonomyTree';
import { QuestionPanel, type QuestaoItem } from '../../components/features/QuestionPanel';
import { useNotifications } from '../../hooks/useNotifications';
import { api } from '../../services/api';

interface ProjetoContext {
  projeto: { id: string; has_taxonomia?: boolean };
}

// Polling interval in milliseconds
const QUEUE_POLL_INTERVAL = 3000;

// Helper to convert API incidence nodes to TaxonomyNode format
interface IncidenciaNode {
  id: string;
  nome: string;
  count: number;
  children?: IncidenciaNode[];
}

function convertIncidenciaToTaxonomyNodes(incidencia: IncidenciaNode[]): TaxonomyNode[] {
  return incidencia.map((node) => ({
    id: node.id,
    nome: node.nome,
    count: node.count,
    children: node.children ? convertIncidenciaToTaxonomyNodes(node.children) : undefined,
  }));
}

export default function ProvasQuestoes() {
  const { projeto } = useOutletContext<ProjetoContext>();
  const addNotification = useNotifications(state => state.addNotification);

  // Queue state
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Taxonomy and questions state
  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>([]);
  const [hasTaxonomia, setHasTaxonomia] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null);
  const [questoes, setQuestoes] = useState<QuestaoItem[]>([]);
  const [totalQuestoes, setTotalQuestoes] = useState(0);
  const [isLoadingQuestoes, setIsLoadingQuestoes] = useState(false);

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
      return [];
    }
  }, [projeto.id]);

  // Fetch taxonomy with incidence counts
  const fetchTaxonomy = useCallback(async () => {
    try {
      // First try to get the full taxonomy with incidence from the edital
      const taxonomiaResponse = await api.getProjetoTaxonomiaIncidencia(projeto.id);

      if (taxonomiaResponse.has_taxonomia && taxonomiaResponse.incidencia.length > 0) {
        // Use the edital's taxonomy structure with counts
        const nodes = convertIncidenciaToTaxonomyNodes(
          taxonomiaResponse.incidencia as IncidenciaNode[]
        );
        setTaxonomyNodes(nodes);
        setHasTaxonomia(true);
        setTotalQuestoes(taxonomiaResponse.total_questoes);
      } else {
        // Fall back to simple disciplina list from questions
        const response = await api.getProjetoQuestoes(projeto.id, { limit: 1 });
        const nodes: TaxonomyNode[] = response.disciplinas.map((disciplina, index) => ({
          id: `disciplina-${index}`,
          nome: disciplina || 'Sem disciplina',
          count: 0, // Will be updated when we have per-disciplina counts
        }));
        setTaxonomyNodes(nodes);
        setHasTaxonomia(false);
        setTotalQuestoes(response.total);
      }
    } catch (error) {
      console.error('Error fetching taxonomy:', error);
      // Try fallback
      try {
        const response = await api.getProjetoQuestoes(projeto.id, { limit: 1 });
        const nodes: TaxonomyNode[] = response.disciplinas.map((disciplina, index) => ({
          id: `disciplina-${index}`,
          nome: disciplina || 'Sem disciplina',
          count: 0,
        }));
        setTaxonomyNodes(nodes);
        setHasTaxonomia(false);
        setTotalQuestoes(response.total);
      } catch (fallbackError) {
        console.error('Error fetching fallback taxonomy:', fallbackError);
      }
    }
  }, [projeto.id]);

  // Fetch questions for selected node (disciplina or topic)
  const fetchQuestoes = useCallback(async (nodeName: string) => {
    setIsLoadingQuestoes(true);
    try {
      const response = await api.getProjetoQuestoes(projeto.id, {
        disciplina: nodeName === 'Sem disciplina' ? '' : nodeName,
        limit: 100,
      });
      setQuestoes(response.questoes);
    } catch (error) {
      console.error('Error fetching questoes:', error);
      addNotification({
        type: 'error',
        title: 'Erro ao carregar questoes',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      setIsLoadingQuestoes(false);
    }
  }, [projeto.id, addNotification]);

  // Handle taxonomy node selection
  const handleNodeSelect = useCallback((nodeId: string, nodeName: string) => {
    setSelectedNode(nodeId);
    setSelectedNodeName(nodeName);
    fetchQuestoes(nodeName);
  }, [fetchQuestoes]);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    setIsPolling(true);
    pollingIntervalRef.current = setInterval(async () => {
      const items = await fetchQueueStatus();
      if (!hasActiveItems(items)) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsPolling(false);
        // Refresh taxonomy when processing completes
        fetchTaxonomy();
      }
    }, QUEUE_POLL_INTERVAL);
  }, [fetchQueueStatus, hasActiveItems, fetchTaxonomy]);

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
      // Also fetch taxonomy
      fetchTaxonomy();
    };

    initializeQueue();

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

        const items = await fetchQueueStatus();

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

  // Handle delete action - deletes prova and all its questions
  const handleDelete = useCallback(async (id: string) => {
    try {
      const result = await api.deleteProva(id);
      addNotification({
        type: 'success',
        title: 'Prova excluída',
        message: result.message,
      });

      // Refresh queue and taxonomy
      await fetchQueueStatus();
      await fetchTaxonomy();
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Erro ao excluir',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }, [addNotification, fetchQueueStatus, fetchTaxonomy]);

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
      {queueItems.length > 0 && (
        <div>
          <h3 className="text-md font-medium text-white mb-4">Fila de Processamento</h3>
          <QueueVisualization
            items={queueItems}
            onRetry={handleRetry}
            onCancel={handleCancel}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* Taxonomy Tree and Questions Panel */}
      {(totalQuestoes > 0 || hasTaxonomia) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Taxonomy Tree - Left Column */}
          <div className="lg:col-span-1">
            <h3 className="text-md font-medium text-white mb-4">
              {hasTaxonomia ? 'Taxonomia do Edital' : 'Disciplinas'} ({totalQuestoes} questoes)
            </h3>
            <TaxonomyTree
              nodes={taxonomyNodes}
              selectedNode={selectedNode}
              onNodeSelect={handleNodeSelect}
            />
          </div>

          {/* Questions Panel - Right Column */}
          <div className="lg:col-span-2">
            <h3 className="text-md font-medium text-white mb-4">
              Questoes
              {selectedNodeName && (
                <span className="text-gray-500 font-normal ml-2">- {selectedNodeName}</span>
              )}
            </h3>
            <QuestionPanel
              questoes={questoes}
              selectedDisciplina={selectedNodeName}
              isLoading={isLoadingQuestoes}
              total={totalQuestoes}
            />
          </div>
        </div>
      )}
    </div>
  );
}
