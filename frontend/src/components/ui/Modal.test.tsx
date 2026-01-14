import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { Modal } from './Modal';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
      // Identify backdrop by className containing bg-black
      const isBackdrop = className?.includes('bg-black');
      return (
        <div
          onClick={onClick}
          className={className}
          data-testid={isBackdrop ? 'modal-backdrop' : undefined}
          {...props}
        >
          {children}
        </div>
      );
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when open', () => {
    it('should render modal content', () => {
      render(<Modal {...defaultProps} />);

      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('should render title', () => {
      render(<Modal {...defaultProps} />);

      expect(screen.getByText('Test Modal')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<Modal {...defaultProps} />);

      // Close button exists in header
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByRole('button');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      // Click on backdrop (the overlay div with onClick)
      const backdrop = screen.getByTestId('modal-backdrop');
      fireEvent.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('when closed', () => {
    it('should not render modal content', () => {
      render(<Modal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('should not render title', () => {
      render(<Modal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    });
  });

  describe('with different sizes', () => {
    it('should apply max-w-md class for sm size', () => {
      const { container } = render(<Modal {...defaultProps} size="sm" />);

      expect(container.innerHTML).toContain('max-w-md');
    });

    it('should apply max-w-2xl class for md size (default)', () => {
      const { container } = render(<Modal {...defaultProps} />);

      expect(container.innerHTML).toContain('max-w-2xl');
    });

    it('should apply max-w-4xl class for lg size', () => {
      const { container } = render(<Modal {...defaultProps} size="lg" />);

      expect(container.innerHTML).toContain('max-w-4xl');
    });

    it('should apply max-w-5xl class for xl size', () => {
      const { container } = render(<Modal {...defaultProps} size="xl" />);

      expect(container.innerHTML).toContain('max-w-5xl');
    });
  });

  describe('escape key handling', () => {
    it('should call onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when other keys are pressed', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('body overflow', () => {
    it('should set body overflow to hidden when open', () => {
      render(<Modal {...defaultProps} isOpen={true} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should reset body overflow when closed', () => {
      const { rerender } = render(<Modal {...defaultProps} isOpen={true} />);

      rerender(<Modal {...defaultProps} isOpen={false} />);

      // Empty string removes inline style, allowing CSS to take over
      expect(document.body.style.overflow).toBe('');
    });
  });
});
