import { cn } from '../../utils/cn';
import {
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconSpinner,
  IconRefresh,
  IconPause,
} from '../ui/Icons';

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
}

// Status configuration with colors, icons, and text
interface StatusConfig {
  icon: React.ReactNode;
  text: string | ((item: QueueItem) => string);
  bgColor: string;
  textColor: string;
  progressColor: string;
  animate?: boolean;
}

function getStatusConfig(item: QueueItem): StatusConfig {
  switch (item.queue_status) {
    case 'pending':
      return {
        icon: <IconPause size={16} />,
        text: 'Na fila',
        bgColor: 'bg-gray-500/20',
        textColor: 'text-gray-400',
        progressColor: 'bg-gray-500',
      };
    case 'validating':
      return {
        icon: <IconSpinner size={16} className="animate-spin" />,
        text: 'Validando...',
        bgColor: 'bg-yellow-500/20',
        textColor: 'text-yellow-400',
        progressColor: 'bg-yellow-500',
        animate: true,
      };
    case 'processing':
      return {
        icon: <IconSpinner size={16} className="animate-spin" />,
        text: (item.progress ?? 0) > 50 ? 'Classificando...' : 'Processando...',
        bgColor: 'bg-blue-500/20',
        textColor: 'text-blue-400',
        progressColor: 'bg-blue-500',
        animate: true,
      };
    case 'completed':
      return {
        icon: <IconCheck size={16} />,
        text: (i: QueueItem) => `${i.total_questoes ?? 0} questoes`,
        bgColor: 'bg-green-500/20',
        textColor: 'text-green-400',
        progressColor: 'bg-green-500',
      };
    case 'partial':
      return {
        icon: <IconAlertTriangle size={16} />,
        text: (i: QueueItem) =>
          `${i.total_questoes ?? 0} questoes (${i.questoes_revisar ?? 0} revisar)`,
        bgColor: 'bg-yellow-500/20',
        textColor: 'text-yellow-400',
        progressColor: 'bg-yellow-500',
      };
    case 'failed':
      return {
        icon: <IconX size={16} />,
        text: (i: QueueItem) => i.queue_error ?? 'Falhou',
        bgColor: 'bg-red-500/20',
        textColor: 'text-red-400',
        progressColor: 'bg-red-500',
      };
    case 'retry':
      return {
        icon: <IconRefresh size={16} />,
        text: 'Aguardando retry',
        bgColor: 'bg-orange-500/20',
        textColor: 'text-orange-400',
        progressColor: 'bg-orange-500',
      };
    default:
      return {
        icon: <IconPause size={16} />,
        text: 'Desconhecido',
        bgColor: 'bg-gray-500/20',
        textColor: 'text-gray-400',
        progressColor: 'bg-gray-500',
      };
  }
}

interface ProgressBarProps {
  progress: number;
  colorClass: string;
  animate?: boolean;
}

function ProgressBar({ progress, colorClass, animate }: ProgressBarProps) {
  return (
    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500 ease-out',
          colorClass,
          animate && 'animate-pulse'
        )}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

interface QueueItemRowProps {
  item: QueueItem;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
}

function QueueItemRow({ item, onRetry, onCancel }: QueueItemRowProps) {
  const config = getStatusConfig(item);
  const progress = item.progress ?? (item.queue_status === 'completed' ? 100 : 0);
  const statusText = typeof config.text === 'function' ? config.text(item) : config.text;

  const canRetry = item.queue_status === 'failed' && onRetry;
  const canCancel =
    (item.queue_status === 'pending' ||
      item.queue_status === 'validating' ||
      item.queue_status === 'processing') &&
    onCancel;

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800/50 transition-colors group"
      data-testid={`queue-item-${item.id}`}
    >
      {/* File name */}
      <div className="w-48 truncate text-sm text-gray-300" title={item.nome}>
        {item.nome}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <ProgressBar
          progress={progress}
          colorClass={config.progressColor}
          animate={config.animate}
        />
        <span className="text-xs text-gray-500 w-10 text-right">{progress}%</span>
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
      <div className="w-16 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canRetry && (
          <button
            onClick={() => onRetry(item.id)}
            className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
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
            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
            title="Cancelar"
            aria-label={`Cancelar ${item.nome}`}
            data-testid={`cancel-${item.id}`}
          >
            <IconX size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function QueueVisualization({ items, onRetry, onCancel }: QueueVisualizationProps) {
  if (items.length === 0) {
    return (
      <div
        className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center"
        data-testid="queue-empty"
      >
        <p className="text-gray-500 text-sm">Nenhum arquivo na fila</p>
      </div>
    );
  }

  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
      data-testid="queue-visualization"
    >
      {items.map((item) => (
        <QueueItemRow
          key={item.id}
          item={item}
          onRetry={onRetry}
          onCancel={onCancel}
        />
      ))}
    </div>
  );
}
