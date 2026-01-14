import { useMemo } from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import type { QueueItem } from './QueueVisualization';

export interface QueueSummaryProps {
  items: QueueItem[];
  onPauseAll?: () => void;
  onCancelAll?: () => void;
  onRetryAll?: () => void;
  isPaused?: boolean;
}

interface QueueStats {
  completed: number;
  total: number;
  totalQuestoes: number;
  needReview: number;
  failed: number;
  processing: number;
  pending: number;
}

function calculateStats(items: QueueItem[]): QueueStats {
  return items.reduce(
    (acc, item) => {
      // Count completed (includes 'completed' and 'partial')
      if (item.queue_status === 'completed' || item.queue_status === 'partial') {
        acc.completed += 1;
      }

      // Count processing (includes 'validating', 'processing', 'retry')
      if (
        item.queue_status === 'validating' ||
        item.queue_status === 'processing' ||
        item.queue_status === 'retry'
      ) {
        acc.processing += 1;
      }

      // Count pending
      if (item.queue_status === 'pending') {
        acc.pending += 1;
      }

      // Count failed
      if (item.queue_status === 'failed') {
        acc.failed += 1;
      }

      // Count items that need review (partial status)
      if (item.queue_status === 'partial') {
        acc.needReview += 1;
      }

      // Sum total questions from completed/partial items
      if (
        (item.queue_status === 'completed' || item.queue_status === 'partial') &&
        item.total_questoes
      ) {
        acc.totalQuestoes += item.total_questoes;
      }

      acc.total += 1;
      return acc;
    },
    {
      completed: 0,
      total: 0,
      totalQuestoes: 0,
      needReview: 0,
      failed: 0,
      processing: 0,
      pending: 0,
    }
  );
}

export function QueueSummary({
  items,
  onPauseAll,
  onCancelAll,
  onRetryAll,
  isPaused = false,
}: QueueSummaryProps) {
  // Calculate stats (must be before any early returns per rules of hooks)
  const stats = useMemo(() => calculateStats(items), [items]);

  // Empty state
  if (items.length === 0) {
    return (
      <div
        className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3"
        data-testid="queue-summary-empty"
      >
        <p className="text-gray-500 text-sm">Nenhum arquivo processado</p>
      </div>
    );
  }

  // Determine button states
  const canPause = stats.processing > 0;
  const canCancel = stats.pending > 0 || stats.processing > 0;
  const canRetry = stats.failed > 0;

  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3"
      data-testid="queue-summary"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Stats section */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-gray-400">Resumo:</span>

          {/* Completed count */}
          <span className="text-green-400" data-testid="stats-completed">
            {stats.completed}/{stats.total} completos
          </span>

          <span className="text-gray-600">|</span>

          {/* Total questions */}
          <span className="text-blue-400" data-testid="stats-questoes">
            {stats.totalQuestoes} questoes
          </span>

          <span className="text-gray-600">|</span>

          {/* Need review */}
          <span
            className={cn(
              stats.needReview > 0 ? 'text-yellow-400' : 'text-gray-500'
            )}
            data-testid="stats-revisar"
          >
            {stats.needReview} para revisar
          </span>

          <span className="text-gray-600">|</span>

          {/* Failed */}
          <span
            className={cn(stats.failed > 0 ? 'text-red-400' : 'text-gray-500')}
            data-testid="stats-failed"
          >
            {stats.failed} falhou
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onPauseAll}
            disabled={!canPause || !onPauseAll}
            data-testid="btn-pause-all"
            aria-label={isPaused ? 'Retomar processamento' : 'Pausar processamento'}
          >
            {isPaused ? 'Retomar' : 'Pausar'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onCancelAll}
            disabled={!canCancel || !onCancelAll}
            data-testid="btn-cancel-all"
            aria-label="Cancelar todos os itens pendentes"
          >
            Cancelar Todos
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onRetryAll}
            disabled={!canRetry || !onRetryAll}
            data-testid="btn-retry-all"
            aria-label="Reprocessar itens que falharam"
          >
            Reprocessar Falhos
          </Button>
        </div>
      </div>
    </div>
  );
}
