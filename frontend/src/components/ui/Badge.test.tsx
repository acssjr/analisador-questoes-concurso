import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/test-utils';
import { Badge } from './Badge';

describe('Badge', () => {
  it('should render with children', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('should apply default variant styles by default', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toHaveClass('bg-dark-surface');
    expect(badge).toHaveClass('text-text-secondary');
  });

  it('should apply success variant styles', () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    // Classes are split: 'bg-semantic-success bg-opacity-20' becomes separate classes
    expect(badge).toHaveClass('bg-opacity-20');
    expect(badge).toHaveClass('border-semantic-success');
    expect(badge).toHaveClass('text-semantic-success');
  });

  it('should apply warning variant styles', () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge).toHaveClass('bg-opacity-20');
    expect(badge).toHaveClass('border-semantic-warning');
    expect(badge).toHaveClass('text-semantic-warning');
  });

  it('should apply error variant styles', () => {
    render(<Badge variant="error">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge).toHaveClass('bg-opacity-20');
    expect(badge).toHaveClass('border-semantic-error');
    expect(badge).toHaveClass('text-semantic-error');
  });

  it('should apply info variant styles', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge).toHaveClass('bg-opacity-20');
    expect(badge).toHaveClass('border-semantic-info');
    expect(badge).toHaveClass('text-semantic-info');
  });

  it('should apply disciplina variant with inline styles', () => {
    render(
      <Badge variant="disciplina" disciplina="Português">
        Português
      </Badge>
    );
    const badge = screen.getByText('Português');
    // The disciplina variant applies inline styles
    expect(badge).toHaveAttribute('style');
  });

  it('should apply base styles', () => {
    render(<Badge>Base</Badge>);
    const badge = screen.getByText('Base');
    expect(badge).toHaveClass('inline-flex');
    expect(badge).toHaveClass('items-center');
    expect(badge).toHaveClass('px-2');
    expect(badge).toHaveClass('py-1');
    expect(badge).toHaveClass('rounded');
    expect(badge).toHaveClass('text-xs');
    expect(badge).toHaveClass('font-medium');
  });

  it('should accept custom className', () => {
    render(<Badge className="custom-badge">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('custom-badge');
  });

  it('should render as span element', () => {
    render(<Badge data-testid="badge">Span</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge.tagName).toBe('SPAN');
  });

  it('should pass through HTML attributes', () => {
    render(<Badge data-testid="test-badge" title="Badge title">Test</Badge>);
    const badge = screen.getByTestId('test-badge');
    expect(badge).toHaveAttribute('title', 'Badge title');
  });
});
