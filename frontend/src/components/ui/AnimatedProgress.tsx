import { cn } from '../../utils/cn';

export interface AnimatedProgressProps {
  /** Progress value 0-100. Undefined = indeterminate (spinning) */
  progress?: number;
  /** Size of the circular progress */
  size?: 'sm' | 'md' | 'lg';
  /** Status determines color */
  status?: 'loading' | 'success' | 'error';
  /** Additional class names */
  className?: string;
}

// Size configurations
const sizeConfig = {
  sm: { diameter: 24, strokeWidth: 3 },
  md: { diameter: 36, strokeWidth: 4 },
  lg: { diameter: 48, strokeWidth: 5 },
};

// Inline keyframes for animations (avoids tailwind.config issues)
const keyframeStyles = `
@keyframes spin-progress {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes pulse-progress {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes dash-progress {
  0% { stroke-dashoffset: 75; }
  50% { stroke-dashoffset: 25; }
  100% { stroke-dashoffset: 75; }
}
@keyframes checkmark-draw {
  0% { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: 0; }
}
`;

export function AnimatedProgress({
  progress,
  size = 'md',
  status = 'loading',
  className,
}: AnimatedProgressProps) {
  const { diameter, strokeWidth } = sizeConfig[size];
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const isIndeterminate = progress === undefined;
  const isComplete = status === 'success';
  const isError = status === 'error';

  // Calculate stroke-dashoffset for determinate progress
  const clampedProgress = Math.min(100, Math.max(0, progress ?? 0));
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  // Color based on status
  const strokeColor = isError
    ? '#ef4444' // red-500
    : isComplete
    ? '#22c55e' // green-500
    : '#3b82f6'; // blue-500

  const trackColor = '#e5e7eb'; // gray-200 (light background)

  return (
    <>
      {/* Inject keyframes once */}
      <style>{keyframeStyles}</style>

      <div
        className={cn('inline-flex items-center justify-center', className)}
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          isComplete
            ? 'Complete'
            : isError
            ? 'Error'
            : isIndeterminate
            ? 'Loading'
            : `${clampedProgress}% complete`
        }
      >
        <svg
          width={diameter}
          height={diameter}
          viewBox={`0 0 ${diameter} ${diameter}`}
          style={
            isIndeterminate && !isComplete && !isError
              ? { animation: 'spin-progress 1.5s linear infinite' }
              : undefined
          }
        >
          {/* Background track */}
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />

          {/* Progress circle */}
          {!isComplete && (
            <circle
              cx={diameter / 2}
              cy={diameter / 2}
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={isIndeterminate ? circumference * 0.75 : strokeDashoffset}
              style={{
                transformOrigin: 'center',
                transform: 'rotate(-90deg)',
                transition: isIndeterminate ? undefined : 'stroke-dashoffset 0.3s ease-out',
                ...(isIndeterminate
                  ? { animation: 'dash-progress 1.5s ease-in-out infinite' }
                  : {}),
              }}
            />
          )}

          {/* Checkmark for success state */}
          {isComplete && (
            <path
              d={getCheckmarkPath(diameter)}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={20}
              strokeDashoffset={0}
              style={{ animation: 'checkmark-draw 0.3s ease-out forwards' }}
            />
          )}

          {/* X mark for error state */}
          {isError && clampedProgress === 100 && (
            <>
              <line
                x1={diameter * 0.3}
                y1={diameter * 0.3}
                x2={diameter * 0.7}
                y2={diameter * 0.7}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              <line
                x1={diameter * 0.7}
                y1={diameter * 0.3}
                x2={diameter * 0.3}
                y2={diameter * 0.7}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            </>
          )}
        </svg>
      </div>
    </>
  );
}

// Helper to generate checkmark path based on size
function getCheckmarkPath(diameter: number): string {
  const cx = diameter / 2;
  const cy = diameter / 2;
  const scale = diameter / 36; // Base scale on medium size

  // Checkmark points relative to center
  const startX = cx - 6 * scale;
  const startY = cy;
  const midX = cx - 2 * scale;
  const midY = cy + 5 * scale;
  const endX = cx + 7 * scale;
  const endY = cy - 5 * scale;

  return `M ${startX} ${startY} L ${midX} ${midY} L ${endX} ${endY}`;
}

export default AnimatedProgress;
