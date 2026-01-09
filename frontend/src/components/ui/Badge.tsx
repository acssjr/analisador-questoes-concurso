import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { getDisciplinaColor } from '../../utils/colors';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'disciplina';
  disciplina?: string;
}

export function Badge({ variant = 'default', disciplina, className, children, ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center px-2 py-1 rounded text-xs font-medium';

  const variantStyles = {
    default: 'bg-dark-surface border border-dark-border text-text-secondary',
    success: 'bg-semantic-success bg-opacity-20 border border-semantic-success text-semantic-success',
    warning: 'bg-semantic-warning bg-opacity-20 border border-semantic-warning text-semantic-warning',
    error: 'bg-semantic-error bg-opacity-20 border border-semantic-error text-semantic-error',
    info: 'bg-semantic-info bg-opacity-20 border border-semantic-info text-semantic-info',
    disciplina: '',
  };

  let style = {};
  if (variant === 'disciplina' && disciplina) {
    const color = getDisciplinaColor(disciplina);
    style = {
      backgroundColor: `${color}20`,
      borderColor: color,
      color: color,
    };
  }

  return (
    <span
      className={cn(baseStyles, variantStyles[variant], className)}
      style={variant === 'disciplina' ? style : undefined}
      {...props}
    >
      {children}
    </span>
  );
}
