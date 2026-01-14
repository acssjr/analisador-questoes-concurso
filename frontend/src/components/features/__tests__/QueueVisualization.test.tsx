import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/test-utils';
import { QueueVisualization, type QueueItem } from '../QueueVisualization';

describe('QueueVisualization', () => {
  // Helper function to create mock queue items
  function createQueueItem(overrides: Partial<QueueItem> = {}): QueueItem {
    return {
      id: '1',
      nome: 'Prova_2023.pdf',
      queue_status: 'pending',
      ...overrides,
    };
  }

  describe('Rendering', () => {
    it('should render empty state when no items', () => {
      render(<QueueVisualization items={[]} />);

      expect(screen.getByTestId('queue-empty')).toBeInTheDocument();
      expect(screen.getByText('Nenhum arquivo na fila')).toBeInTheDocument();
    });

    it('should render queue items when provided', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', nome: 'Prova_2023.pdf' }),
        createQueueItem({ id: '2', nome: 'Prova_2022.pdf' }),
      ];

      render(<QueueVisualization items={items} />);

      expect(screen.getByTestId('queue-visualization')).toBeInTheDocument();
      expect(screen.getByTestId('queue-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('queue-item-2')).toBeInTheDocument();
      expect(screen.getByText('Prova_2023.pdf')).toBeInTheDocument();
      expect(screen.getByText('Prova_2022.pdf')).toBeInTheDocument();
    });

    it('should display file names', () => {
      const items: QueueItem[] = [
        createQueueItem({ nome: 'arquivo_muito_longo_que_deve_ser_truncado.pdf' }),
      ];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('arquivo_muito_longo_que_deve_ser_truncado.pdf')).toBeInTheDocument();
    });
  });

  describe('Status States', () => {
    it('should display pending status correctly', () => {
      const items: QueueItem[] = [createQueueItem({ queue_status: 'pending' })];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('Na fila')).toBeInTheDocument();
    });

    it('should display validating status correctly', () => {
      const items: QueueItem[] = [createQueueItem({ queue_status: 'validating' })];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('Validando PDF...')).toBeInTheDocument();
    });

    it('should display processing status with detailed text based on progress', () => {
      const items: QueueItem[] = [
        createQueueItem({ queue_status: 'processing', progress: 30 }),
      ];

      render(<QueueVisualization items={items} />);

      // Progress 30% maps to "Detectando questoes..."
      expect(screen.getByText('Detectando questoes...')).toBeInTheDocument();
    });

    it('should display Classificando when progress is between 60-80', () => {
      const items: QueueItem[] = [
        createQueueItem({ queue_status: 'processing', progress: 75 }),
      ];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('Classificando...')).toBeInTheDocument();
    });

    it('should display completed status with question count', () => {
      const items: QueueItem[] = [
        createQueueItem({
          queue_status: 'completed',
          total_questoes: 60,
          progress: 100,
        }),
      ];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('60 questoes')).toBeInTheDocument();
    });

    it('should display partial status with question count and review count', () => {
      const items: QueueItem[] = [
        createQueueItem({
          queue_status: 'partial',
          total_questoes: 48,
          questoes_revisar: 3,
          progress: 100,
        }),
      ];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('48 questoes (3 revisar)')).toBeInTheDocument();
    });

    it('should display failed status with error message', () => {
      const items: QueueItem[] = [
        createQueueItem({
          queue_status: 'failed',
          queue_error: 'PDF e imagem',
        }),
      ];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('PDF e imagem')).toBeInTheDocument();
    });

    it('should display retry status correctly', () => {
      const items: QueueItem[] = [createQueueItem({ queue_status: 'retry' })];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('Aguardando retry')).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('should display progress percentage', () => {
      const items: QueueItem[] = [
        createQueueItem({ queue_status: 'processing', progress: 50 }),
      ];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should display 0% for pending items (determinate state)', () => {
      const items: QueueItem[] = [createQueueItem({ queue_status: 'pending' })];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should display -- for validating items (indeterminate state)', () => {
      const items: QueueItem[] = [createQueueItem({ queue_status: 'validating' })];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('--')).toBeInTheDocument();
    });

    it('should display 100% for completed items without explicit progress', () => {
      const items: QueueItem[] = [
        createQueueItem({ queue_status: 'completed', total_questoes: 10 }),
      ];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should have progressbar role for accessibility', () => {
      const items: QueueItem[] = [
        createQueueItem({ queue_status: 'processing', progress: 75 }),
      ];

      render(<QueueVisualization items={items} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute('aria-valuenow', '75');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('Action Buttons', () => {
    it('should show retry button for failed items when onRetry is provided', () => {
      const onRetry = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: 'fail-1', queue_status: 'failed', queue_error: 'Error' }),
      ];

      render(<QueueVisualization items={items} onRetry={onRetry} />);

      const retryButton = screen.getByTestId('retry-fail-1');
      expect(retryButton).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: 'fail-1', queue_status: 'failed', queue_error: 'Error' }),
      ];

      render(<QueueVisualization items={items} onRetry={onRetry} />);

      const retryButton = screen.getByTestId('retry-fail-1');
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledWith('fail-1');
    });

    it('should not show retry button for non-failed items', () => {
      const onRetry = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: 'pending-1', queue_status: 'pending' }),
      ];

      render(<QueueVisualization items={items} onRetry={onRetry} />);

      expect(screen.queryByTestId('retry-pending-1')).not.toBeInTheDocument();
    });

    it('should show cancel button for pending items when onCancel is provided', () => {
      const onCancel = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: 'pending-1', queue_status: 'pending' }),
      ];

      render(<QueueVisualization items={items} onCancel={onCancel} />);

      const cancelButton = screen.getByTestId('cancel-pending-1');
      expect(cancelButton).toBeInTheDocument();
    });

    it('should show cancel button for validating items when onCancel is provided', () => {
      const onCancel = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: 'validating-1', queue_status: 'validating' }),
      ];

      render(<QueueVisualization items={items} onCancel={onCancel} />);

      const cancelButton = screen.getByTestId('cancel-validating-1');
      expect(cancelButton).toBeInTheDocument();
    });

    it('should show cancel button for processing items when onCancel is provided', () => {
      const onCancel = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: 'processing-1', queue_status: 'processing', progress: 50 }),
      ];

      render(<QueueVisualization items={items} onCancel={onCancel} />);

      const cancelButton = screen.getByTestId('cancel-processing-1');
      expect(cancelButton).toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: 'pending-1', queue_status: 'pending' }),
      ];

      render(<QueueVisualization items={items} onCancel={onCancel} />);

      const cancelButton = screen.getByTestId('cancel-pending-1');
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalledWith('pending-1');
    });

    it('should not show cancel button for completed items', () => {
      const onCancel = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({
          id: 'completed-1',
          queue_status: 'completed',
          total_questoes: 10,
        }),
      ];

      render(<QueueVisualization items={items} onCancel={onCancel} />);

      expect(screen.queryByTestId('cancel-completed-1')).not.toBeInTheDocument();
    });

    it('should not show cancel button for failed items', () => {
      const onCancel = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({ id: 'failed-1', queue_status: 'failed', queue_error: 'Error' }),
      ];

      render(<QueueVisualization items={items} onCancel={onCancel} />);

      expect(screen.queryByTestId('cancel-failed-1')).not.toBeInTheDocument();
    });

    it('should not show action buttons when callbacks are not provided', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: 'pending-1', queue_status: 'pending' }),
        createQueueItem({ id: 'failed-1', queue_status: 'failed', queue_error: 'Error' }),
      ];

      render(<QueueVisualization items={items} />);

      expect(screen.queryByTestId('cancel-pending-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('retry-failed-1')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for retry buttons', () => {
      const onRetry = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({
          id: 'fail-1',
          nome: 'Prova_2023.pdf',
          queue_status: 'failed',
          queue_error: 'Error',
        }),
      ];

      render(<QueueVisualization items={items} onRetry={onRetry} />);

      const retryButton = screen.getByLabelText('Tentar novamente Prova_2023.pdf');
      expect(retryButton).toBeInTheDocument();
    });

    it('should have accessible labels for cancel buttons', () => {
      const onCancel = vi.fn();
      const items: QueueItem[] = [
        createQueueItem({
          id: 'pending-1',
          nome: 'Prova_2022.pdf',
          queue_status: 'pending',
        }),
      ];

      render(<QueueVisualization items={items} onCancel={onCancel} />);

      const cancelButton = screen.getByLabelText('Cancelar Prova_2022.pdf');
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('should show error message for failed items', () => {
      const items: QueueItem[] = [
        createQueueItem({
          queue_status: 'failed',
          queue_error: 'Arquivo corrompido',
        }),
      ];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('Arquivo corrompido')).toBeInTheDocument();
    });

    it('should show default error text when queue_error is not provided', () => {
      const items: QueueItem[] = [
        createQueueItem({
          queue_status: 'failed',
        }),
      ];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('Falhou')).toBeInTheDocument();
    });
  });

  describe('Multiple Items', () => {
    it('should render all status types correctly', () => {
      const items: QueueItem[] = [
        createQueueItem({ id: '1', nome: 'Prova_2023.pdf', queue_status: 'completed', total_questoes: 60, progress: 100 }),
        createQueueItem({ id: '2', nome: 'Prova_2022.pdf', queue_status: 'processing', progress: 50 }),
        createQueueItem({ id: '3', nome: 'Prova_2021.pdf', queue_status: 'pending' }),
        createQueueItem({ id: '4', nome: 'Prova_2020.pdf', queue_status: 'partial', total_questoes: 48, questoes_revisar: 3, progress: 100 }),
        createQueueItem({ id: '5', nome: 'Prova_2019.pdf', queue_status: 'failed', queue_error: 'PDF e imagem' }),
      ];

      render(<QueueVisualization items={items} />);

      expect(screen.getByText('60 questoes')).toBeInTheDocument();
      // Progress 50% maps to "Processando questoes..."
      expect(screen.getByText('Processando questoes...')).toBeInTheDocument();
      expect(screen.getByText('Na fila')).toBeInTheDocument();
      expect(screen.getByText('48 questoes (3 revisar)')).toBeInTheDocument();
      expect(screen.getByText('PDF e imagem')).toBeInTheDocument();
    });
  });
});
