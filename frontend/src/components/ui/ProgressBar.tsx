import { cn } from '../../utils/cn';

export type ProgressVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
export type ProgressMode = 'determinate' | 'indeterminate';

export interface ProgressBarProps {
  /** Progress value from 0 to 100 (ignored in indeterminate mode) */
  progress?: number;
  /** Visual variant/color scheme */
  variant?: ProgressVariant;
  /** Determinate (shows percentage) or indeterminate (animated, unknown progress) */
  mode?: ProgressMode;
  /** Height of the progress bar */
  size?: 'sm' | 'md' | 'lg';
  /** Show percentage label */
  showLabel?: boolean;
  /** Custom label text (overrides percentage) */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

const variantColors: Record<ProgressVariant, { bg: string; fill: string }> = {
  default: {
    bg: 'bg-gray-700',
    fill: 'bg-gray-500',
  },
  success: {
    bg: 'bg-green-900/30',
    fill: 'bg-green-500',
  },
  warning: {
    bg: 'bg-yellow-900/30',
    fill: 'bg-yellow-500',
  },
  error: {
    bg: 'bg-red-900/30',
    fill: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-900/30',
    fill: 'bg-blue-500',
  },
};

const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

export function ProgressBar({
  progress = 0,
  variant = 'default',
  mode = 'determinate',
  size = 'md',
  showLabel = false,
  label,
  className,
  ariaLabel,
}: ProgressBarProps) {
  const colors = variantColors[variant];
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'w-full rounded-full overflow-hidden',
          colors.bg,
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={mode === 'determinate' ? clampedProgress : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
      >
        {mode === 'determinate' ? (
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              colors.fill,
              // Add subtle glow effect when actively progressing
              clampedProgress > 0 && clampedProgress < 100 && 'shadow-[0_0_8px_rgba(255,255,255,0.3)]'
            )}
            style={{ width: `${clampedProgress}%` }}
          />
        ) : (
          // Indeterminate mode with sliding animation
          <div
            className={cn(
              'h-full rounded-full',
              colors.fill,
              'animate-progress-indeterminate'
            )}
          />
        )}
      </div>
      {showLabel && (
        <span className="text-xs text-gray-400 mt-1">
          {label ?? `${clampedProgress}%`}
        </span>
      )}
    </div>
  );
}

/**
 * Progress bar with pulsing animation for active processing states.
 * Shows activity even when progress percentage is 0.
 */
export function PulsingProgressBar({
  progress = 0,
  variant = 'info',
  size = 'md',
  statusText,
  className,
}: {
  progress?: number;
  variant?: ProgressVariant;
  size?: 'sm' | 'md' | 'lg';
  statusText?: string;
  className?: string;
}) {
  const colors = variantColors[variant];
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const isActive = clampedProgress < 100;

  return (
    <div className={cn('w-full space-y-2', className)}>
      {statusText && (
        <div className="flex items-center gap-2">
          {isActive && (
            <div className="relative flex h-2 w-2">
              <span className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                colors.fill
              )} />
              <span className={cn(
                'relative inline-flex rounded-full h-2 w-2',
                colors.fill
              )} />
            </div>
          )}
          <span className={cn(
            'text-sm',
            isActive ? 'text-gray-300 animate-pulse' : 'text-gray-400'
          )}>
            {statusText}
          </span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex-1 rounded-full overflow-hidden',
            colors.bg,
            sizeClasses[size]
          )}
          role="progressbar"
          aria-valuenow={clampedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out relative',
              colors.fill,
              // Add shimmer effect when active
              isActive && 'overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent after:animate-shimmer'
            )}
            style={{ width: `${Math.max(clampedProgress, isActive ? 5 : 0)}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 w-10 text-right tabular-nums">
          {clampedProgress}%
        </span>
      </div>
    </div>
  );
}
