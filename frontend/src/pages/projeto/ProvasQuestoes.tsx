// frontend/src/pages/projeto/ProvasQuestoes.tsx
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useOutletContext } from 'react-router';
import { UploadDropzone } from '../../components/features/UploadDropzone';
import { QueueVisualization, type QueueItem } from '../../components/features/QueueVisualization';
import { QueueSummary } from '../../components/features/QueueSummary';
import { QuestionPanel, type QuestaoItem } from '../../components/features/QuestionPanel';
import { useNotifications } from '../../hooks/useNotifications';
import { api } from '../../services/api';
import { BookOpen, ChevronRight } from 'lucide-react';

interface ProjetoContext {
  projeto: { id: string; has_taxonomia?: boolean };
}

// Polling interval in milliseconds
const QUEUE_POLL_INTERVAL = 3000;

// Simple discipline item for the sidebar
interface DisciplinaItem {
  nome: string;
  count: number;
}

// Memoized discipline list item
const DisciplinaListItem = memo(function DisciplinaListItem({
  disciplina,
  isSelected,
  onSelect,
}: {
  disciplina: DisciplinaItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left ${
        isSelected
          ? 'bg-[var(--accent-green)] text-white'
          : 'hover:bg-gray-100 text-gray-700'
      }`}
    >
      <span className="text-[14px] font-medium truncate flex-1">{disciplina.nome}</span>
      <div className="flex items-center gap-2">
        <span className={`text-[12px] ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
          {disciplina.count}
        </span>
        <ChevronRight size={14} className={isSelected ? 'text-white/60' : 'text-gray-400'} />
      </div>
    </button>
  );
});

export default function ProvasQuestoes() {
  const { projeto } = useOutletContext<ProjetoContext>();
  const addNotification = useNotifications(state => state.addNotification);

  // Queue state
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Discipline and questions state (simple list, not taxonomy tree)
  const [disciplinas, setDisciplinas] = useState<DisciplinaItem[]>([]);
  const [selectedDisciplina, setSelectedDisciplina] = useState<string | null>(null);
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

  // Fetch discipline list with counts (simple flat list from questions)
  const fetchDisciplinas = useCallback(async () => {
    try {
      // Get questions grouped by discipline - this uses the discipline from the questions themselves
      const response = await api.getProjetoQuestoes(projeto.id, { limit: 1 });

      // Build discipline counts from the disciplinas array returned by the API
      const disciplinaCounts: DisciplinaItem[] = response.disciplinas.map((nome) => ({
        nome,
        count: 0, // We'll fetch actual counts below
      }));

      // Get total questions
      setTotalQuestoes(response.total);

      // If we have disciplinas, fetch counts for each (or use a single call)
      if (disciplinaCounts.length > 0) {
        // Fetch all questions to count by discipline
        const allResponse = await api.getProjetoQuestoes(projeto.id, { limit: 500 });
        const counts: Record<string, number> = {};
        allResponse.questoes.forEach((q) => {
          const disc = q.disciplina || 'Sem disciplina';
          counts[disc] = (counts[disc] || 0) + 1;
        });

        // Update discipline list with counts
        const disciplinasWithCounts = Object.entries(counts).map(([nome, count]) => ({
          nome,
          count,
        }));

        // Sort by the first question number in each discipline (exam order)
        const disciplineOrder: Record<string, number> = {};
        allResponse.questoes.forEach((q) => {
          const disc = q.disciplina || 'Sem disciplina';
          if (!(disc in disciplineOrder) || q.numero < disciplineOrder[disc]) {
            disciplineOrder[disc] = q.numero;
          }
        });
        disciplinasWithCounts.sort((a, b) =>
          (disciplineOrder[a.nome] || 999) - (disciplineOrder[b.nome] || 999)
        );

        setDisciplinas(disciplinasWithCounts);

        // Auto-select first discipline if none selected
        if (!selectedDisciplina && disciplinasWithCounts.length > 0) {
          setSelectedDisciplina(disciplinasWithCounts[0].nome);
          fetchQuestoes(disciplinasWithCounts[0].nome);
        }
      } else {
        setDisciplinas([]);
      }
    } catch (error) {
      console.error('Error fetching disciplinas:', error);
      setDisciplinas([]);
      setTotalQuestoes(0);
    }
  }, [projeto.id, selectedDisciplina]);

  // Fetch questions for selected discipline
  const fetchQuestoes = useCallback(async (disciplinaNome: string) => {
    setIsLoadingQuestoes(true);
    try {
      const response = await api.getProjetoQuestoes(projeto.id, {
        disciplina: disciplinaNome === 'Sem disciplina' ? '' : disciplinaNome,
        limit: 100,
      });
      // Sort questions by numero
      const sortedQuestoes = [...response.questoes].sort((a, b) => a.numero - b.numero);
      setQuestoes(sortedQuestoes);
    } catch (error) {
      console.error('Error fetching questoes:', error);
      addNotification({
        type: 'error',
        title: 'Erro ao carregar questões',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      setIsLoadingQuestoes(false);
    }
  }, [projeto.id, addNotification]);

  // Handle discipline selection
  const handleDisciplinaSelect = useCallback((disciplinaNome: string) => {
    setSelectedDisciplina(disciplinaNome);
    fetchQuestoes(disciplinaNome);
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
        fetchDisciplinas();
      }
    }, QUEUE_POLL_INTERVAL);
  }, [fetchQueueStatus, hasActiveItems, fetchDisciplinas]);

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
      fetchDisciplinas();
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
      await fetchDisciplinas();
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Erro ao excluir',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }, [addNotification, fetchQueueStatus, fetchDisciplinas]);

  return (
    <div className="space-y-6" data-projeto-id={projeto.id}>
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-gray-900">Provas & Questões</h2>
        {isPolling && (
          <span className="text-[12px] text-[var(--accent-green)] animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[var(--accent-green)] rounded-full animate-pulse"></span>
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
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-[15px] font-semibold text-gray-900 mb-4">Fila de Processamento</h3>
          <QueueVisualization
            items={queueItems}
            onRetry={handleRetry}
            onCancel={handleCancel}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* Disciplines and Questions Panel */}
      {totalQuestoes > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Discipline List - Left Column (simple flat list) */}
          <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-[15px] font-semibold text-gray-900 mb-4">
              Disciplinas
              <span className="text-gray-500 font-normal ml-1">({totalQuestoes} questões)</span>
            </h3>
            {disciplinas.length > 0 ? (
              <div className="space-y-1">
                {disciplinas.map((disciplina) => (
                  <DisciplinaListItem
                    key={disciplina.nome}
                    disciplina={disciplina}
                    isSelected={selectedDisciplina === disciplina.nome}
                    onSelect={() => handleDisciplinaSelect(disciplina.nome)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-[13px] text-gray-500">Nenhuma questão ainda</p>
              </div>
            )}
          </div>

          {/* Questions Panel - Right Column */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-[15px] font-semibold text-gray-900 mb-4">
              Questões
              {selectedDisciplina && (
                <span className="text-gray-500 font-normal ml-2">— {selectedDisciplina}</span>
              )}
            </h3>
            <QuestionPanel
              questoes={questoes}
              selectedDisciplina={selectedDisciplina}
              isLoading={isLoadingQuestoes}
              total={questoes.length}
            />
          </div>
        </div>
      )}

      {/* Empty state when no questions */}
      {totalQuestoes === 0 && queueItems.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <BookOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <h3 className="text-[15px] font-medium text-gray-900 mb-2">Nenhuma questão extraída</h3>
          <p className="text-[13px] text-gray-500">
            Faça upload de provas em PDF para extrair as questões
          </p>
        </div>
      )}
    </div>
  );
}
