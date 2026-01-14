import { useEffect, useState } from 'react';
import { IconCheck, IconX, IconLoader, IconFileText } from './Icons';

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export interface UploadProgressProps {
  status: UploadStatus;
  progress?: number; // 0-100, undefined for indeterminate
  fileName?: string;
  message?: string;
  error?: string;
  onCancel?: () => void;
}

// Status configuration
const statusConfig = {
  idle: {
    color: 'var(--text-muted)',
    bgColor: 'var(--bg-subtle)',
    icon: IconFileText,
  },
  uploading: {
    color: 'var(--accent-blue)',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    icon: IconLoader,
  },
  processing: {
    color: 'var(--accent-amber)',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    icon: IconLoader,
  },
  success: {
    color: 'var(--accent-green)',
    bgColor: 'rgba(27, 67, 50, 0.1)',
    icon: IconCheck,
  },
  error: {
    color: 'var(--accent-red)',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    icon: IconX,
  },
};

export function UploadProgress({
  status,
  progress,
  fileName,
  message,
  error,
}: UploadProgressProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimating = status === 'uploading' || status === 'processing';
  const isIndeterminate = isAnimating && progress === undefined;

  // Simulated progress for visual feedback when no real progress available
  const [simulatedProgress, setSimulatedProgress] = useState(0);

  useEffect(() => {
    if (!isIndeterminate) {
      setSimulatedProgress(0);
      return;
    }

    // Simulate progress that slows down as it approaches 90%
    const interval = setInterval(() => {
      setSimulatedProgress((prev) => {
        if (prev >= 90) return prev;
        const increment = Math.max(0.5, (90 - prev) / 20);
        return Math.min(90, prev + increment);
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isIndeterminate]);

  // Use real progress if available, otherwise simulated
  const displayProgress = progress !== undefined ? progress : simulatedProgress;

  return (
    <div
      className="rounded-xl p-4 transition-all duration-300"
      style={{ backgroundColor: config.bgColor }}
    >
      {/* Header with icon and status */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
          style={{ backgroundColor: `color-mix(in srgb, ${config.color} 20%, transparent)` }}
        >
          <Icon
            size={20}
            className={`transition-all duration-300 ${isAnimating ? 'animate-spin' : ''}`}
            style={{ color: config.color }}
          />
        </div>
        <div className="flex-1 min-w-0">
          {fileName && (
            <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
              {fileName}
            </p>
          )}
          <p className="text-[12px]" style={{ color: config.color }}>
            {message || getDefaultMessage(status)}
          </p>
        </div>
        {progress !== undefined && (
          <span
            className="text-[14px] font-semibold tabular-nums"
            style={{ color: config.color }}
          >
            {Math.round(progress)}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-2 rounded-full overflow-hidden bg-[var(--bg-muted)]">
        {isIndeterminate ? (
          // Indeterminate animated bar
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${config.color} 50%, transparent 100%)`,
              animation: 'indeterminate-progress 1.5s ease-in-out infinite',
            }}
          />
        ) : (
          // Determinate progress bar
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${displayProgress}%`,
              backgroundColor: config.color,
            }}
          />
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-2 text-[12px] text-[var(--accent-red)]">{error}</p>
      )}

      {/* Inline keyframes for indeterminate animation */}
      <style>{`
        @keyframes indeterminate-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}

function getDefaultMessage(status: UploadStatus): string {
  switch (status) {
    case 'idle':
      return 'Aguardando arquivo...';
    case 'uploading':
      return 'Enviando arquivo...';
    case 'processing':
      return 'Processando...';
    case 'success':
      return 'Concluído!';
    case 'error':
      return 'Erro no upload';
    default:
      return '';
  }
}

// Multi-step progress component for complex workflows
export interface WorkflowStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  message?: string;
}

export interface WorkflowProgressProps {
  steps: WorkflowStep[];
  currentStepIndex: number;
}

export function WorkflowProgress({ steps, currentStepIndex }: WorkflowProgressProps) {
  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex;
        const isCompleted = index < currentStepIndex || step.status === 'completed';
        const isError = step.status === 'error';

        let statusColor = 'var(--text-muted)';
        let bgColor = 'var(--bg-subtle)';

        if (isError) {
          statusColor = 'var(--accent-red)';
          bgColor = 'rgba(239, 68, 68, 0.1)';
        } else if (isCompleted) {
          statusColor = 'var(--accent-green)';
          bgColor = 'rgba(27, 67, 50, 0.1)';
        } else if (isActive) {
          statusColor = 'var(--accent-blue)';
          bgColor = 'rgba(59, 130, 246, 0.1)';
        }

        return (
          <div
            key={step.id}
            className="flex items-center gap-3 p-3 rounded-lg transition-all duration-300"
            style={{ backgroundColor: isActive ? bgColor : 'transparent' }}
          >
            {/* Step indicator */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold transition-all duration-300"
              style={{
                backgroundColor: bgColor,
                color: statusColor,
                border: isActive ? `2px solid ${statusColor}` : 'none',
              }}
            >
              {isCompleted ? (
                <IconCheck size={14} />
              ) : isError ? (
                <IconX size={14} />
              ) : (
                index + 1
              )}
            </div>

            {/* Step label */}
            <div className="flex-1">
              <p
                className="text-[13px] font-medium transition-colors duration-300"
                style={{ color: isActive || isCompleted ? 'var(--text-primary)' : 'var(--text-muted)' }}
              >
                {step.label}
              </p>
              {step.message && isActive && (
                <p className="text-[11px]" style={{ color: statusColor }}>
                  {step.message}
                </p>
              )}
            </div>

            {/* Loading indicator for active step */}
            {isActive && !isCompleted && !isError && (
              <IconLoader size={16} className="animate-spin" style={{ color: statusColor }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
