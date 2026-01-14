import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '../../../test/test-utils';
import { UploadDropzone } from '../UploadDropzone';
import { useNotifications } from '../../../hooks/useNotifications';

// Mock the useNotifications hook
vi.mock('../../../hooks/useNotifications', () => ({
  useNotifications: vi.fn(),
}));

describe('UploadDropzone', () => {
  const mockOnFilesSelected = vi.fn();
  const mockAddNotification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNotifications as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = { addNotification: mockAddNotification };
      return selector(state);
    });
  });

  // Helper to create mock File objects
  function createMockFile(
    name: string,
    size: number,
    type: string
  ): File {
    const content = new Array(size).fill('a').join('');
    return new File([content], name, { type });
  }

  // Helper to create a mock dataTransfer object for drop events
  function createMockDataTransfer(files: File[]) {
    return {
      files: files,
      items: files.map(file => ({ kind: 'file', type: file.type, getAsFile: () => file })),
      types: ['Files'],
    };
  }

  describe('Rendering', () => {
    it('should render with default state', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument();
      expect(screen.getByText(/Arraste PDFs de provas aqui ou clique para selecionar/i)).toBeInTheDocument();
      expect(screen.getByText(/Apenas arquivos PDF/i)).toBeInTheDocument();
    });

    it('should display the correct max file size', () => {
      const maxSize = 25 * 1024 * 1024; // 25MB
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} maxFileSize={maxSize} />);

      expect(screen.getByText(/max. 25MB/i)).toBeInTheDocument();
    });

    it('should apply disabled styles when disabled', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} disabled />);

      const dropzone = screen.getByTestId('upload-dropzone');
      expect(dropzone).toHaveAttribute('aria-disabled', 'true');
      expect(dropzone).toHaveClass('opacity-50');
      expect(dropzone).toHaveClass('cursor-not-allowed');
    });

    it('should apply custom className', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} className="custom-class" />);

      const dropzone = screen.getByTestId('upload-dropzone');
      expect(dropzone).toHaveClass('custom-class');
    });

    it('should have accessible role and label', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      const dropzone = screen.getByRole('button', { name: /Upload de arquivos PDF/i });
      expect(dropzone).toBeInTheDocument();
      expect(dropzone).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Click to Select', () => {
    it('should open file dialog when clicked', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const dropzone = screen.getByTestId('upload-dropzone');
      fireEvent.click(dropzone);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should not open file dialog when disabled and clicked', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} disabled />);

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const dropzone = screen.getByTestId('upload-dropzone');
      fireEvent.click(dropzone);

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('should call onFilesSelected when valid PDF files are selected', async () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      const pdfFile = createMockFile('test.pdf', 1024, 'application/pdf');
      const fileInput = screen.getByTestId('file-input');

      // Simulate file selection
      Object.defineProperty(fileInput, 'files', {
        value: [pdfFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      expect(mockOnFilesSelected).toHaveBeenCalledWith([pdfFile]);
    });

    it('should handle multiple file selection', async () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      const pdf1 = createMockFile('test1.pdf', 1024, 'application/pdf');
      const pdf2 = createMockFile('test2.pdf', 2048, 'application/pdf');
      const fileInput = screen.getByTestId('file-input');

      Object.defineProperty(fileInput, 'files', {
        value: [pdf1, pdf2],
        writable: false,
      });

      fireEvent.change(fileInput);

      expect(mockOnFilesSelected).toHaveBeenCalledWith([pdf1, pdf2]);
    });
  });

  describe('Drag and Drop', () => {
    it('should show drag over visual state when dragging files over', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      const dropzone = screen.getByTestId('upload-dropzone');

      // Initially no drag over styles
      expect(dropzone).not.toHaveClass('border-blue-500');

      // Simulate drag over
      fireEvent.dragEnter(dropzone);
      fireEvent.dragOver(dropzone);

      expect(dropzone).toHaveClass('border-blue-500');
      expect(dropzone).toHaveClass('scale-[1.02]');
    });

    it('should remove drag over state when dragging leaves', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      const dropzone = screen.getByTestId('upload-dropzone');

      fireEvent.dragEnter(dropzone);
      fireEvent.dragOver(dropzone);
      expect(dropzone).toHaveClass('border-blue-500');

      // Simulate drag leave - need to ensure relatedTarget is outside dropzone
      fireEvent.dragLeave(dropzone, { relatedTarget: document.body });

      expect(dropzone).not.toHaveClass('border-blue-500');
    });

    it('should call onFilesSelected when valid PDF files are dropped', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      const pdfFile = createMockFile('test.pdf', 1024, 'application/pdf');
      const dataTransfer = createMockDataTransfer([pdfFile]);

      const dropzone = screen.getByTestId('upload-dropzone');
      fireEvent.drop(dropzone, { dataTransfer });

      expect(mockOnFilesSelected).toHaveBeenCalledWith([pdfFile]);
    });

    it('should not accept drops when disabled', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} disabled />);

      const pdfFile = createMockFile('test.pdf', 1024, 'application/pdf');
      const dataTransfer = createMockDataTransfer([pdfFile]);

      const dropzone = screen.getByTestId('upload-dropzone');
      fireEvent.drop(dropzone, { dataTransfer });

      expect(mockOnFilesSelected).not.toHaveBeenCalled();
    });

    it('should not show drag over state when disabled', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} disabled />);

      const dropzone = screen.getByTestId('upload-dropzone');

      fireEvent.dragEnter(dropzone);
      fireEvent.dragOver(dropzone);

      expect(dropzone).not.toHaveClass('border-blue-500');
    });
  });

  describe('File Validation', () => {
    it('should reject non-PDF files with toast notification', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      const textFile = createMockFile('test.txt', 1024, 'text/plain');
      const dataTransfer = createMockDataTransfer([textFile]);

      const dropzone = screen.getByTestId('upload-dropzone');
      fireEvent.drop(dropzone, { dataTransfer });

      expect(mockOnFilesSelected).not.toHaveBeenCalled();
      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Arquivo rejeitado',
        message: expect.stringContaining('test.txt'),
      });
    });

    it('should reject files exceeding max size', () => {
      const maxSize = 1024; // 1KB for testing
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} maxFileSize={maxSize} />);

      const largePdf = createMockFile('large.pdf', 2048, 'application/pdf');
      const dataTransfer = createMockDataTransfer([largePdf]);

      const dropzone = screen.getByTestId('upload-dropzone');
      fireEvent.drop(dropzone, { dataTransfer });

      expect(mockOnFilesSelected).not.toHaveBeenCalled();
      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Arquivo muito grande',
        message: expect.stringContaining('large.pdf'),
      });
    });

    it('should accept PDF files by extension even with wrong MIME type', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      // Sometimes PDF files might have wrong MIME type
      const pdfByExtension = createMockFile('test.pdf', 1024, 'application/octet-stream');
      const dataTransfer = createMockDataTransfer([pdfByExtension]);

      const dropzone = screen.getByTestId('upload-dropzone');
      fireEvent.drop(dropzone, { dataTransfer });

      expect(mockOnFilesSelected).toHaveBeenCalledWith([pdfByExtension]);
    });

    it('should filter out invalid files and only pass valid ones', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      const validPdf = createMockFile('valid.pdf', 1024, 'application/pdf');
      const invalidText = createMockFile('invalid.txt', 1024, 'text/plain');
      const dataTransfer = createMockDataTransfer([validPdf, invalidText]);

      const dropzone = screen.getByTestId('upload-dropzone');
      fireEvent.drop(dropzone, { dataTransfer });

      expect(mockOnFilesSelected).toHaveBeenCalledWith([validPdf]);
      expect(mockAddNotification).toHaveBeenCalled();
    });
  });

  describe('Feedback', () => {
    it('should show selected count feedback after files are selected', async () => {
      vi.useFakeTimers();

      try {
        render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

        const pdfFile = createMockFile('test.pdf', 1024, 'application/pdf');
        const dataTransfer = createMockDataTransfer([pdfFile]);

        const dropzone = screen.getByTestId('upload-dropzone');
        fireEvent.drop(dropzone, { dataTransfer });

        expect(screen.getByText(/1 arquivo selecionado/i)).toBeInTheDocument();

        // Advance timers wrapped in act to allow React to process state updates
        await act(async () => {
          vi.advanceTimersByTime(2100);
        });

        expect(screen.queryByText(/1 arquivo selecionado/i)).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should show plural form for multiple files', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      const pdf1 = createMockFile('test1.pdf', 1024, 'application/pdf');
      const pdf2 = createMockFile('test2.pdf', 1024, 'application/pdf');
      const dataTransfer = createMockDataTransfer([pdf1, pdf2]);

      const dropzone = screen.getByTestId('upload-dropzone');
      fireEvent.drop(dropzone, { dataTransfer });

      expect(screen.getByText(/2 arquivos selecionados/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should open file dialog on Enter key', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const dropzone = screen.getByTestId('upload-dropzone');
      fireEvent.keyDown(dropzone, { key: 'Enter' });

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should open file dialog on Space key', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} />);

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const dropzone = screen.getByTestId('upload-dropzone');
      fireEvent.keyDown(dropzone, { key: ' ' });

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should not respond to keyboard when disabled', () => {
      render(<UploadDropzone onFilesSelected={mockOnFilesSelected} disabled />);

      const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const dropzone = screen.getByTestId('upload-dropzone');
      expect(dropzone).toHaveAttribute('tabIndex', '-1');

      fireEvent.keyDown(dropzone, { key: 'Enter' });
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });
});
