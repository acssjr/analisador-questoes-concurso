import { cn } from '../../utils/cn';
import {
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconSpinner,
  IconRefresh,
  IconPause,
  IconTrash,
} from '../ui/Icons';
import { AnimatedProgress } from '../ui/AnimatedProgress';

// Queue item status type
export type QueueStatus =
  | 'pending'
  | 'validating'
  | 'processing'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'retry';

export interface QueueItem {
  id: string;
  nome: string;
  queue_status: QueueStatus;
  queue_error?: string;
  progress?: number; // 0-100
  total_questoes?: number;
  questoes_revisar?: number;
  confianca_media?: number;
}

export interface QueueVisualizationProps {
  items: QueueItem[];
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// Helper to get detailed processing status text based on progress percentage
function getProcessingStatusText(progress: number): string {
  if (progress === 0) return 'Iniciando...';
  if (progress < 20) return 'Extraindo texto...';
  if (progress < 40) return 'Detectando questoes...';
  if (progress < 60) return 'Processando questoes...';
  if (progress < 80) return 'Classificando...';
  if (progress < 100) return 'Finalizando...';
  return 'Concluido';
}

// Status configuration with colors, icons, and text
interface StatusConfig {
  icon: React.ReactNode;
  text: string | ((item: QueueItem) => string);
  bgColor: string;
  textColor: string;
  progressColor: string;
  animate?: boolean;
  isIndeterminate?: boolean;
}

function getStatusConfig(item: QueueItem): StatusConfig {
  switch (item.queue_status) {
    case 'pending':
      return {
        icon: <IconPause size={16} />,
        text: 'Na fila',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-500',
        progressColor: 'bg-gray-400',
      };
    case 'validating':
      return {
        icon: <IconSpinner size={16} className="animate-spin" />,
        text: 'Validando PDF...',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700',
        progressColor: 'bg-yellow-500',
        animate: true,
        isIndeterminate: true, // Unknown progress during validation
      };
    case 'processing':
      return {
        icon: <IconSpinner size={16} className="animate-spin" />,
        text: getProcessingStatusText(item.progress ?? 0),
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-700',
        progressColor: 'bg-blue-500',
        animate: true,
        // Use indeterminate if progress is 0 (just started)
        isIndeterminate: (item.progress ?? 0) === 0,
      };
    case 'completed':
      return {
        icon: <IconCheck size={16} />,
        text: (i: QueueItem) => `${i.total_questoes ?? 0} questoes`,
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        progressColor: 'bg-green-500',
      };
    case 'partial':
      return {
        icon: <IconAlertTriangle size={16} />,
        text: (i: QueueItem) =>
          `${i.total_questoes ?? 0} questoes (${i.questoes_revisar ?? 0} revisar)`,
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700',
        progressColor: 'bg-yellow-500',
      };
    case 'failed':
      return {
        icon: <IconX size={16} />,
        text: (i: QueueItem) => i.queue_error ?? 'Falhou',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        progressColor: 'bg-red-500',
      };
    case 'retry':
      return {
        icon: <IconRefresh size={16} />,
        text: 'Aguardando retry',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-700',
        progressColor: 'bg-orange-500',
      };
    default:
      return {
        icon: <IconPause size={16} />,
        text: 'Desconhecido',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-500',
        progressColor: 'bg-gray-400',
      };
  }
}

// Helper to convert queue status to AnimatedProgress status
function getProgressStatus(queueStatus: QueueStatus): 'loading' | 'success' | 'error' {
  switch (queueStatus) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    default:
      return 'loading';
  }
}

interface QueueItemRowProps {
  item: QueueItem;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function QueueItemRow({ item, onRetry, onCancel, onDelete }: QueueItemRowProps) {
  const config = getStatusConfig(item);
  const progress = item.progress ?? (item.queue_status === 'completed' ? 100 : 0);
  const statusText = typeof config.text === 'function' ? config.text(item) : config.text;

  const canRetry = item.queue_status === 'failed' && onRetry;
  const canCancel =
    (item.queue_status === 'pending' ||
      item.queue_status === 'validating' ||
      item.queue_status === 'processing') &&
    onCancel;
  const canDelete =
    (item.queue_status === 'completed' ||
      item.queue_status === 'failed' ||
      item.queue_status === 'partial') &&
    onDelete;

  // Determine progress value for AnimatedProgress
  // undefined = indeterminate (spinning), number = determinate
  const progressValue = config.isIndeterminate ? undefined : progress;
  const progressStatus = getProgressStatus(item.queue_status);

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group"
      data-testid={`queue-item-${item.id}`}
    >
      {/* File name */}
      <div className="w-48 truncate text-sm text-gray-700" title={item.nome}>
        {item.nome}
      </div>

      {/* Circular progress indicator */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <AnimatedProgress
          progress={progressValue}
          size="sm"
          status={progressStatus}
        />
        <span className="text-xs text-gray-500 w-10 text-right tabular-nums">
          {config.isIndeterminate ? '--' : `${progress}%`}
        </span>
      </div>

      {/* Status indicator */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium min-w-[140px]',
          config.bgColor,
          config.textColor
        )}
        title={item.queue_status === 'failed' ? item.queue_error : undefined}
      >
        {config.icon}
        <span className="truncate">{statusText}</span>
      </div>

      {/* Action buttons */}
      <div className="w-20 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canRetry && (
          <button
            onClick={() => onRetry(item.id)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Tentar novamente"
            aria-label={`Tentar novamente ${item.nome}`}
            data-testid={`retry-${item.id}`}
          >
            <IconRefresh size={14} />
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => onCancel(item.id)}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Cancelar"
            aria-label={`Cancelar ${item.nome}`}
            data-testid={`cancel-${item.id}`}
          >
            <IconX size={14} />
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(item.id)}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Excluir prova e questões"
            aria-label={`Excluir ${item.nome}`}
            data-testid={`delete-${item.id}`}
          >
            <IconTrash size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function QueueVisualization({ items, onRetry, onCancel, onDelete }: QueueVisualizationProps) {
  if (items.length === 0) {
    return (
      <div
        className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center"
        data-testid="queue-empty"
      >
        <p className="text-gray-500 text-sm">Nenhum arquivo na fila</p>
      </div>
    );
  }

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100"
      data-testid="queue-visualization"
    >
      {items.map((item) => (
        <QueueItemRow
          key={item.id}
          item={item}
          onRetry={onRetry}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
