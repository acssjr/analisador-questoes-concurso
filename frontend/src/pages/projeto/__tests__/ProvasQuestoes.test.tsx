import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '../../../test/test-utils';
import ProvasQuestoes from '../ProvasQuestoes';
import { api } from '../../../services/api';
import { useNotifications } from '../../../hooks/useNotifications';
import { useOutletContext } from 'react-router';
import type { QueueItem } from '../../../components/features/QueueVisualization';

// Mock dependencies
vi.mock('react-router', () => ({
  useOutletContext: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  api: {
    uploadProvasProjeto: vi.fn(),
    getProvaQueueStatus: vi.fn(),
    retryProvaProcessing: vi.fn(),
    cancelProvaProcessing: vi.fn(),
    getProjetoQuestoes: vi.fn(),
    getProjetoTaxonomiaIncidencia: vi.fn(),
  },
}));

vi.mock('../../../hooks/useNotifications', () => ({
  useNotifications: vi.fn(),
}));

describe('ProvasQuestoes', () => {
  const mockProjetoId = 'projeto-123';
  const mockAddNotification = vi.fn();

  // Helper to create mock QueueItem
  function createMockQueueItem(overrides: Partial<QueueItem> = {}): QueueItem {
    return {
      id: 'item-1',
      nome: 'prova-test.pdf',
      queue_status: 'pending',
      progress: 0,
      ...overrides,
    };
  }

  // Helper to create mock File
  function createMockFile(name: string): File {
    return new File(['test content'], name, { type: 'application/pdf' });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup default mocks
    (useOutletContext as ReturnType<typeof vi.fn>).mockReturnValue({
      projeto: { id: mockProjetoId },
    });

    (useNotifications as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = { addNotification: mockAddNotification };
      return selector(state);
    });

    // Default: empty queue
    (api.getProvaQueueStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [] });

    // Default: empty questoes
    (api.getProjetoQuestoes as ReturnType<typeof vi.fn>).mockResolvedValue({
      questoes: [],
      total: 0,
      disciplinas: [],
    });

    // Default: empty taxonomy
    (api.getProjetoTaxonomiaIncidencia as ReturnType<typeof vi.fn>).mockResolvedValue({
      taxonomia: [],
      total_questoes: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render all main components', async () => {
      render(<ProvasQuestoes />);

      // Wait for initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Check header
      expect(screen.getByText('Provas & Questões')).toBeInTheDocument();

      // Check upload dropzone is rendered
      expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument();

      // Check queue summary (empty state)
      expect(screen.getByTestId('queue-summary-empty')).toBeInTheDocument();

      // Queue visualization is not rendered when empty (conditional render)
      expect(screen.queryByTestId('queue-visualization')).not.toBeInTheDocument();
    });

    it('should render projeto id in data attribute', async () => {
      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const container = document.querySelector(`[data-projeto-id="${mockProjetoId}"]`);
      expect(container).toBeInTheDocument();
    });
  });

  describe('Initial Queue Fetch', () => {
    it('should fetch queue status on mount', async () => {
      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(api.getProvaQueueStatus).toHaveBeenCalledWith(mockProjetoId);
    });

    it('should display queue items when they exist', async () => {
      // Use completed items only to avoid triggering polling
      const mockItems: QueueItem[] = [
        createMockQueueItem({ id: '1', nome: 'prova1.pdf', queue_status: 'completed', progress: 100, total_questoes: 10 }),
        createMockQueueItem({ id: '2', nome: 'prova2.pdf', queue_status: 'completed', progress: 100, total_questoes: 5 }),
      ];

      (api.getProvaQueueStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ items: mockItems });

      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByTestId('queue-visualization')).toBeInTheDocument();
      expect(screen.getByTestId('queue-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('queue-item-2')).toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    it('should upload files and show success notification', async () => {
      (api.uploadProvasProjeto as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        total_files: 2,
        successful_files: 2,
        failed_files: 0,
        results: [
          { success: true, filename: 'prova1.pdf', prova_id: 'p1' },
          { success: true, filename: 'prova2.pdf', prova_id: 'p2' },
        ],
      });

      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Simulate file selection through the dropzone
      const dropzone = screen.getByTestId('upload-dropzone');
      const file1 = createMockFile('prova1.pdf');
      const file2 = createMockFile('prova2.pdf');

      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: {
            files: [file1, file2],
            items: [
              { kind: 'file', type: 'application/pdf', getAsFile: () => file1 },
              { kind: 'file', type: 'application/pdf', getAsFile: () => file2 },
            ],
            types: ['Files'],
          },
        });
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(api.uploadProvasProjeto).toHaveBeenCalledWith(mockProjetoId, [file1, file2]);
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: 'Upload concluído',
        })
      );
    });

    it('should show error notification on upload failure', async () => {
      (api.uploadProvasProjeto as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const dropzone = screen.getByTestId('upload-dropzone');
      const file = createMockFile('prova.pdf');

      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: {
            files: [file],
            items: [{ kind: 'file', type: 'application/pdf', getAsFile: () => file }],
            types: ['Files'],
          },
        });
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Erro no upload',
        })
      );
    });

    it('should show individual file errors', async () => {
      (api.uploadProvasProjeto as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        total_files: 2,
        successful_files: 1,
        failed_files: 1,
        results: [
          { success: true, filename: 'prova1.pdf', prova_id: 'p1' },
          { success: false, filename: 'prova2.pdf', error: 'Invalid PDF format' },
        ],
      });

      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const dropzone = screen.getByTestId('upload-dropzone');
      const file1 = createMockFile('prova1.pdf');
      const file2 = createMockFile('prova2.pdf');

      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: {
            files: [file1, file2],
            items: [
              { kind: 'file', type: 'application/pdf', getAsFile: () => file1 },
              { kind: 'file', type: 'application/pdf', getAsFile: () => file2 },
            ],
            types: ['Files'],
          },
        });
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Falha: prova2.pdf',
          message: 'Invalid PDF format',
        })
      );
    });
  });

  describe('Polling', () => {
    it('should start polling when there are active items after upload', async () => {
      // Simulate: processing -> completed to stop polling naturally
      const processingItem = createMockQueueItem({ id: '1', nome: 'prova.pdf', queue_status: 'processing', progress: 10 });
      const completedItem = createMockQueueItem({ id: '1', nome: 'prova.pdf', queue_status: 'completed', progress: 100 });

      (api.uploadProvasProjeto as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        total_files: 1,
        successful_files: 1,
        failed_files: 0,
        results: [{ success: true, filename: 'prova.pdf', prova_id: 'p1' }],
      });

      // First call returns empty, then processing, then completed
      (api.getProvaQueueStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ items: [] })
        .mockResolvedValueOnce({ items: [processingItem] })
        .mockResolvedValue({ items: [completedItem] });

      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Upload a file
      const dropzone = screen.getByTestId('upload-dropzone');
      const file = createMockFile('prova.pdf');

      await act(async () => {
        fireEvent.drop(dropzone, {
          dataTransfer: {
            files: [file],
            items: [{ kind: 'file', type: 'application/pdf', getAsFile: () => file }],
            types: ['Files'],
          },
        });
        await vi.advanceTimersByTimeAsync(100);
      });

      // Advance time to trigger polling (3000ms interval)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // Should have fetched queue status multiple times (initial + after upload + polling)
      // The exact count may vary, but should be at least 3 (initial, after upload, at least one poll)
      expect(api.getProvaQueueStatus).toHaveBeenCalled();
      expect((api.getProvaQueueStatus as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should stop polling when all items are completed', async () => {
      const processingItem = createMockQueueItem({ queue_status: 'processing', progress: 50 });
      const completedItem = createMockQueueItem({ queue_status: 'completed', progress: 100, total_questoes: 10 });

      (api.getProvaQueueStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ items: [processingItem] })
        .mockResolvedValueOnce({ items: [completedItem] })
        .mockResolvedValue({ items: [completedItem] });

      render(<ProvasQuestoes />);

      // Initial fetch triggers polling because of processing item
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // First poll - item now completed
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      const callCountAfterStop = (api.getProvaQueueStatus as ReturnType<typeof vi.fn>).mock.calls.length;

      // Advance more time - should not poll anymore
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });

      // Call count should be the same (polling stopped)
      expect((api.getProvaQueueStatus as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountAfterStop);
    });
  });

  describe('Retry Action', () => {
    it('should call retry API and show notification', async () => {
      const failedItem = createMockQueueItem({
        id: 'failed-1',
        nome: 'failed.pdf',
        queue_status: 'failed',
        queue_error: 'Processing error',
      });
      const completedItem = createMockQueueItem({
        id: 'failed-1',
        nome: 'failed.pdf',
        queue_status: 'completed',
        total_questoes: 10,
      });

      // First returns failed, after retry returns completed (simulate fast processing)
      (api.getProvaQueueStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ items: [failedItem] })
        .mockResolvedValue({ items: [completedItem] });
      (api.retryProvaProcessing as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Find and click retry button
      const retryButton = screen.getByTestId('retry-failed-1');

      await act(async () => {
        fireEvent.click(retryButton);
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(api.retryProvaProcessing).toHaveBeenCalledWith('failed-1');
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Reprocessando',
        })
      );
    });

    it('should show error notification on retry failure', async () => {
      const failedItem = createMockQueueItem({
        id: 'failed-1',
        queue_status: 'failed',
      });

      (api.getProvaQueueStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [failedItem] });
      (api.retryProvaProcessing as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Retry failed'));

      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const retryButton = screen.getByTestId('retry-failed-1');

      await act(async () => {
        fireEvent.click(retryButton);
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Erro ao reprocessar',
        })
      );
    });
  });

  describe('Cancel Action', () => {
    it('should call cancel API and show notification', async () => {
      // Use pending item to avoid infinite polling from processing
      const pendingItem = createMockQueueItem({
        id: 'pending-1',
        nome: 'pending.pdf',
        queue_status: 'pending',
        progress: 0,
      });
      const cancelledItem = createMockQueueItem({
        id: 'pending-1',
        nome: 'pending.pdf',
        queue_status: 'failed',
        queue_error: 'Cancelled',
        progress: 0,
      });

      // First call returns pending, after cancel returns cancelled (failed)
      (api.getProvaQueueStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ items: [pendingItem] })
        .mockResolvedValue({ items: [cancelledItem] });
      (api.cancelProvaProcessing as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Find and click cancel button
      const cancelButton = screen.getByTestId('cancel-pending-1');

      await act(async () => {
        fireEvent.click(cancelButton);
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(api.cancelProvaProcessing).toHaveBeenCalledWith('pending-1');
      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Cancelado',
        })
      );
    });
  });

  describe('Queue Summary Actions', () => {
    it('should retry all failed items when clicking retry all', async () => {
      const failedItems: QueueItem[] = [
        createMockQueueItem({ id: 'f1', queue_status: 'failed' }),
        createMockQueueItem({ id: 'f2', queue_status: 'failed' }),
        createMockQueueItem({ id: 'c1', queue_status: 'completed', total_questoes: 10 }),
      ];
      // After retry, items become completed (simulate fast processing)
      const afterRetryItems: QueueItem[] = [
        createMockQueueItem({ id: 'f1', queue_status: 'completed', total_questoes: 5 }),
        createMockQueueItem({ id: 'f2', queue_status: 'completed', total_questoes: 5 }),
        createMockQueueItem({ id: 'c1', queue_status: 'completed', total_questoes: 10 }),
      ];

      (api.getProvaQueueStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ items: failedItems })
        .mockResolvedValue({ items: afterRetryItems });
      (api.retryProvaProcessing as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const retryAllButton = screen.getByTestId('btn-retry-all');

      await act(async () => {
        fireEvent.click(retryAllButton);
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should have called retry for both failed items
      expect(api.retryProvaProcessing).toHaveBeenCalledWith('f1');
      expect(api.retryProvaProcessing).toHaveBeenCalledWith('f2');
      expect(api.retryProvaProcessing).toHaveBeenCalledTimes(2);
    });

    it('should cancel all active items when clicking cancel all', async () => {
      // Only pending items to avoid infinite polling from processing
      const mixedItems: QueueItem[] = [
        createMockQueueItem({ id: 'p1', queue_status: 'pending' }),
        createMockQueueItem({ id: 'p2', queue_status: 'pending' }),
        createMockQueueItem({ id: 'c1', queue_status: 'completed', total_questoes: 10 }),
      ];
      const afterCancelItems: QueueItem[] = [
        createMockQueueItem({ id: 'p1', queue_status: 'failed', queue_error: 'Cancelled' }),
        createMockQueueItem({ id: 'p2', queue_status: 'failed', queue_error: 'Cancelled' }),
        createMockQueueItem({ id: 'c1', queue_status: 'completed', total_questoes: 10 }),
      ];

      (api.getProvaQueueStatus as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ items: mixedItems })
        .mockResolvedValue({ items: afterCancelItems });
      (api.cancelProvaProcessing as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const cancelAllButton = screen.getByTestId('btn-cancel-all');

      await act(async () => {
        fireEvent.click(cancelAllButton);
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should have called cancel for both pending items
      expect(api.cancelProvaProcessing).toHaveBeenCalledWith('p1');
      expect(api.cancelProvaProcessing).toHaveBeenCalledWith('p2');
      expect(api.cancelProvaProcessing).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle queue status fetch error gracefully', async () => {
      (api.getProvaQueueStatus as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      // Should not throw
      render(<ProvasQuestoes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Component should still render
      expect(screen.getByText('Provas & Questões')).toBeInTheDocument();
    });
  });
});
