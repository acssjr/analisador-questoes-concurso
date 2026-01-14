import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/test-utils';
import { QueueSummary } from '../QueueSummary';
import type { QueueItem } from '../QueueVisualization';

describe('QueueSummary', () => {
  // Helper function to create mock queue items
  function createQueueItem(overrides: Partial<QueueItem> = {}): QueueItem {
    return {
      id: '1',
      nome: 'Prova_2023.pdf',
      queue_status: 'pending',
      ...overrides,
    };
  }

  describe('Empty State', () => {
    it('should render empty state when no items', () => {
      render(<QueueSummary items={[]} />);

      expect(screen.getByTestId('queue-summary-empty')).toBeInTheDocument();
      expect(screen.getByText('Nenhum arquivo processado')).toBeInTheDocument();
    });

    it('should not render stats or buttons in empty state', () => {
      render(<QueueSummary items={[]} />);

      expect(screen.queryByTestId('queue-summary')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-pause-all')).not.toBeInTheDocument();
    });
  });

  describe('Stats Calculation', () => {
    it('should display correct completed count', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed', total_questoes: 30 }),
        createQueueItem({ id: '2', queue_status: 'completed', total_questoes: 25 }),
        createQueueItem({ id: '3', queue_status: 'pending' }),
        createQueueItem({ id: '4', queue_status: 'processing', progress: 50 }),
        createQueueItem({ id: '5', queue_status: 'failed', queue_error: 'Error' }),
      ];

      render(<QueueSummary items={items} />);

      expect(screen.getByTestId('stats-completed')).toHaveTextContent('2/5 completos');
    });

    it('should include partial status in completed count', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed', total_questoes: 30 }),
        createQueueItem({ id: '2', queue_status: 'partial', total_questoes: 20, questoes_revisar: 3 }),
        createQueueItem({ id: '3', queue_status: 'pending' }),
      ];

      render(<QueueSummary items={items} />);

      expect(screen.getByTestId('stats-completed')).toHaveTextContent('2/3 completos');
    });

    it('should display correct total questions count', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed', total_questoes: 60 }),
        createQueueItem({ id: '2', queue_status: 'completed', total_questoes: 48 }),
        createQueueItem({ id: '3', queue_status: 'pending' }),
      ];

      render(<QueueSummary items={items} />);

      expect(screen.getByTestId('stats-questoes')).toHaveTextContent('108 questoes');
    });

    it('should include partial items in total questions count', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed', total_questoes: 50 }),
        createQueueItem({ id: '2', queue_status: 'partial', total_questoes: 30, questoes_revisar: 5 }),
      ];

      render(<QueueSummary items={items} />);

      expect(screen.getByTestId('stats-questoes')).toHaveTextContent('80 questoes');
    });

    it('should display correct need review count (partial status)', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed', total_questoes: 30 }),
        createQueueItem({ id: '2', queue_status: 'partial', total_questoes: 20, questoes_revisar: 3 }),
        createQueueItem({ id: '3', queue_status: 'partial', total_questoes: 25, questoes_revisar: 2 }),
        createQueueItem({ id: '4', queue_status: 'pending' }),
      ];

      render(<QueueSummary items={items} />);

      expect(screen.getByTestId('stats-revisar')).toHaveTextContent('2 para revisar');
    });

    it('should display correct failed count', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed', total_questoes: 30 }),
        createQueueItem({ id: '2', queue_status: 'failed', queue_error: 'Error 1' }),
        createQueueItem({ id: '3', queue_status: 'failed', queue_error: 'Error 2' }),
        createQueueItem({ id: '4', queue_status: 'pending' }),
      ];

      render(<QueueSummary items={items} />);

      expect(screen.getByTestId('stats-failed')).toHaveTextContent('2 falhou');
    });

    it('should handle items without total_questoes', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed' }), // No total_questoes
        createQueueItem({ id: '2', queue_status: 'completed', total_questoes: 40 }),
      ];

      render(<QueueSummary items={items} />);

      expect(screen.getByTestId('stats-questoes')).toHaveTextContent('40 questoes');
    });
  });

  describe('Stats Styling', () => {
    it('should highlight need review count when greater than 0', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'partial', total_questoes: 20, questoes_revisar: 3 }),
      ];

      render(<QueueSummary items={items} />);

      const revisar = screen.getByTestId('stats-revisar');
      expect(revisar).toHaveClass('text-yellow-400');
    });

    it('should dim need review count when 0', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed', total_questoes: 30 }),
      ];

      render(<QueueSummary items={items} />);

      const revisar = screen.getByTestId('stats-revisar');
      expect(revisar).toHaveClass('text-gray-500');
    });

    it('should highlight failed count when greater than 0', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'failed', queue_error: 'Error' }),
      ];

      render(<QueueSummary items={items} />);

      const failed = screen.getByTestId('stats-failed');
      expect(failed).toHaveClass('text-red-400');
    });

    it('should dim failed count when 0', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed', total_questoes: 30 }),
      ];

      render(<QueueSummary items={items} />);

      const failed = screen.getByTestId('stats-failed');
      expect(failed).toHaveClass('text-gray-500');
    });
  });

  describe('Pause Button', () => {
    it('should be disabled when nothing is processing', () => {
      const onPauseAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed', total_questoes: 30 }),
        createQueueItem({ id: '2', queue_status: 'pending' }),
      ];

      render(<QueueSummary items={items} onPauseAll={onPauseAll} />);

      const pauseBtn = screen.getByTestId('btn-pause-all');
      expect(pauseBtn).toBeDisabled();
    });

    it('should be enabled when items are processing', () => {
      const onPauseAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'processing', progress: 50 }),
      ];

      render(<QueueSummary items={items} onPauseAll={onPauseAll} />);

      const pauseBtn = screen.getByTestId('btn-pause-all');
      expect(pauseBtn).not.toBeDisabled();
    });

    it('should be enabled when items are validating', () => {
      const onPauseAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'validating' }),
      ];

      render(<QueueSummary items={items} onPauseAll={onPauseAll} />);

      const pauseBtn = screen.getByTestId('btn-pause-all');
      expect(pauseBtn).not.toBeDisabled();
    });

    it('should be enabled when items are in retry status', () => {
      const onPauseAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'retry' }),
      ];

      render(<QueueSummary items={items} onPauseAll={onPauseAll} />);

      const pauseBtn = screen.getByTestId('btn-pause-all');
      expect(pauseBtn).not.toBeDisabled();
    });

    it('should call onPauseAll when clicked', () => {
      const onPauseAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'processing', progress: 50 }),
      ];

      render(<QueueSummary items={items} onPauseAll={onPauseAll} />);

      const pauseBtn = screen.getByTestId('btn-pause-all');
      fireEvent.click(pauseBtn);

      expect(onPauseAll).toHaveBeenCalledTimes(1);
    });

    it('should show "Pausar" text when not paused', () => {
      const onPauseAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'processing', progress: 50 }),
      ];

      render(<QueueSummary items={items} onPauseAll={onPauseAll} isPaused={false} />);

      expect(screen.getByTestId('btn-pause-all')).toHaveTextContent('Pausar');
    });

    it('should show "Retomar" text when paused', () => {
      const onPauseAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'processing', progress: 50 }),
      ];

      render(<QueueSummary items={items} onPauseAll={onPauseAll} isPaused={true} />);

      expect(screen.getByTestId('btn-pause-all')).toHaveTextContent('Retomar');
    });

    it('should be disabled when onPauseAll is not provided', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'processing', progress: 50 }),
      ];

      render(<QueueSummary items={items} />);

      const pauseBtn = screen.getByTestId('btn-pause-all');
      expect(pauseBtn).toBeDisabled();
    });
  });

  describe('Cancel All Button', () => {
    it('should be disabled when nothing is pending or processing', () => {
      const onCancelAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed', total_questoes: 30 }),
        createQueueItem({ id: '2', queue_status: 'failed', queue_error: 'Error' }),
      ];

      render(<QueueSummary items={items} onCancelAll={onCancelAll} />);

      const cancelBtn = screen.getByTestId('btn-cancel-all');
      expect(cancelBtn).toBeDisabled();
    });

    it('should be enabled when items are pending', () => {
      const onCancelAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'pending' }),
      ];

      render(<QueueSummary items={items} onCancelAll={onCancelAll} />);

      const cancelBtn = screen.getByTestId('btn-cancel-all');
      expect(cancelBtn).not.toBeDisabled();
    });

    it('should be enabled when items are processing', () => {
      const onCancelAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'processing', progress: 50 }),
      ];

      render(<QueueSummary items={items} onCancelAll={onCancelAll} />);

      const cancelBtn = screen.getByTestId('btn-cancel-all');
      expect(cancelBtn).not.toBeDisabled();
    });

    it('should call onCancelAll when clicked', () => {
      const onCancelAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'pending' }),
      ];

      render(<QueueSummary items={items} onCancelAll={onCancelAll} />);

      const cancelBtn = screen.getByTestId('btn-cancel-all');
      fireEvent.click(cancelBtn);

      expect(onCancelAll).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when onCancelAll is not provided', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'pending' }),
      ];

      render(<QueueSummary items={items} />);

      const cancelBtn = screen.getByTestId('btn-cancel-all');
      expect(cancelBtn).toBeDisabled();
    });
  });

  describe('Retry All Button', () => {
    it('should be disabled when no items have failed', () => {
      const onRetryAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed', total_questoes: 30 }),
        createQueueItem({ id: '2', queue_status: 'pending' }),
      ];

      render(<QueueSummary items={items} onRetryAll={onRetryAll} />);

      const retryBtn = screen.getByTestId('btn-retry-all');
      expect(retryBtn).toBeDisabled();
    });

    it('should be enabled when items have failed', () => {
      const onRetryAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'failed', queue_error: 'Error' }),
      ];

      render(<QueueSummary items={items} onRetryAll={onRetryAll} />);

      const retryBtn = screen.getByTestId('btn-retry-all');
      expect(retryBtn).not.toBeDisabled();
    });

    it('should call onRetryAll when clicked', () => {
      const onRetryAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'failed', queue_error: 'Error' }),
      ];

      render(<QueueSummary items={items} onRetryAll={onRetryAll} />);

      const retryBtn = screen.getByTestId('btn-retry-all');
      fireEvent.click(retryBtn);

      expect(onRetryAll).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when onRetryAll is not provided', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'failed', queue_error: 'Error' }),
      ];

      render(<QueueSummary items={items} />);

      const retryBtn = screen.getByTestId('btn-retry-all');
      expect(retryBtn).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label for pause button', () => {
      const onPauseAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'processing', progress: 50 }),
      ];

      render(<QueueSummary items={items} onPauseAll={onPauseAll} />);

      expect(screen.getByLabelText('Pausar processamento')).toBeInTheDocument();
    });

    it('should have accessible label for resume button when paused', () => {
      const onPauseAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'processing', progress: 50 }),
      ];

      render(<QueueSummary items={items} onPauseAll={onPauseAll} isPaused={true} />);

      expect(screen.getByLabelText('Retomar processamento')).toBeInTheDocument();
    });

    it('should have accessible label for cancel all button', () => {
      const onCancelAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'pending' }),
      ];

      render(<QueueSummary items={items} onCancelAll={onCancelAll} />);

      expect(screen.getByLabelText('Cancelar todos os itens pendentes')).toBeInTheDocument();
    });

    it('should have accessible label for retry all button', () => {
      const onRetryAll = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'failed', queue_error: 'Error' }),
      ];

      render(<QueueSummary items={items} onRetryAll={onRetryAll} />);

      expect(screen.getByLabelText('Reprocessar itens que falharam')).toBeInTheDocument();
    });
  });

  describe('Full Integration', () => {
    it('should render all stats and buttons correctly for a mixed queue', () => {
      const onPauseAll = vi.fn();
      const onCancelAll = vi.fn();
      const onRetryAll = vi.fn();

      const items: QueueItem[] = [
        createQueueItem({ id: '1', queue_status: 'completed', total_questoes: 60 }),
        createQueueItem({ id: '2', queue_status: 'completed', total_questoes: 48 }),
        createQueueItem({ id: '3', queue_status: 'partial', total_questoes: 30, questoes_revisar: 3 }),
        createQueueItem({ id: '4', queue_status: 'processing', progress: 50 }),
        createQueueItem({ id: '5', queue_status: 'pending' }),
        createQueueItem({ id: '6', queue_status: 'failed', queue_error: 'PDF corrupto' }),
      ];

      render(
        <QueueSummary
          items={items}
          onPauseAll={onPauseAll}
          onCancelAll={onCancelAll}
          onRetryAll={onRetryAll}
        />
      );

      // Check stats
      expect(screen.getByTestId('stats-completed')).toHaveTextContent('3/6 completos');
      expect(screen.getByTestId('stats-questoes')).toHaveTextContent('138 questoes');
      expect(screen.getByTestId('stats-revisar')).toHaveTextContent('1 para revisar');
      expect(screen.getByTestId('stats-failed')).toHaveTextContent('1 falhou');

      // All buttons should be enabled
      expect(screen.getByTestId('btn-pause-all')).not.toBeDisabled();
      expect(screen.getByTestId('btn-cancel-all')).not.toBeDisabled();
      expect(screen.getByTestId('btn-retry-all')).not.toBeDisabled();
    });
  });
});
