import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { cn } from '../../utils/cn';
import { IconUpload, IconFilePdf } from '../ui/Icons';
import { useNotifications } from '../../hooks/useNotifications';

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  maxFileSize?: number; // in bytes, default 50MB
  className?: string;
}

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function UploadDropzone({
  onFilesSelected,
  disabled = false,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  className,
}: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addNotification = useNotifications(state => state.addNotification);

  const validateFiles = useCallback((files: File[]): File[] => {
    const validFiles: File[] = [];
    const invalidTypes: string[] = [];
    const oversizedFiles: string[] = [];

    for (const file of files) {
      // Check file type
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        invalidTypes.push(file.name);
        continue;
      }

      // Check file size
      if (file.size > maxFileSize) {
        oversizedFiles.push(file.name);
        continue;
      }

      validFiles.push(file);
    }

    // Show error notifications for rejected files
    if (invalidTypes.length > 0) {
      addNotification({
        type: 'error',
        title: 'Arquivo rejeitado',
        message: `Apenas arquivos PDF sao aceitos: ${invalidTypes.join(', ')}`,
      });
    }

    if (oversizedFiles.length > 0) {
      const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
      addNotification({
        type: 'error',
        title: 'Arquivo muito grande',
        message: `Tamanho maximo: ${maxSizeMB}MB. Arquivos: ${oversizedFiles.join(', ')}`,
      });
    }

    return validFiles;
  }, [addNotification, maxFileSize]);

  const handleFiles = useCallback((files: File[]) => {
    if (disabled) return;

    const validFiles = validateFiles(files);

    if (validFiles.length > 0) {
      // Show selected feedback briefly
      setSelectedCount(validFiles.length);
      setTimeout(() => setSelectedCount(null), 2000);

      onFilesSelected(validFiles);
    }
  }, [disabled, onFilesSelected, validateFiles]);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragOver to false if we're leaving the dropzone (not entering a child)
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, [disabled, handleFiles]);

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    handleFiles(selectedFiles);

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFiles]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      handleClick();
    }
  }, [disabled, handleClick]);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload de arquivos PDF"
      aria-disabled={disabled}
      className={cn(
        'relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
        // Default state
        !isDragOver && !disabled && 'border-gray-700 hover:border-gray-600 bg-gray-900/50',
        // Drag over state
        isDragOver && !disabled && 'border-blue-500 bg-blue-500/10 scale-[1.02]',
        // Disabled state
        disabled && 'border-gray-800 bg-gray-900/30 cursor-not-allowed opacity-50',
        className
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid="upload-dropzone"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
        data-testid="file-input"
        aria-hidden="true"
      />

      <div className="flex flex-col items-center gap-4">
        {/* Icon */}
        <div className={cn(
          'p-4 rounded-full transition-colors',
          isDragOver && !disabled ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-400'
        )}>
          {isDragOver ? (
            <IconFilePdf size={32} />
          ) : (
            <IconUpload size={32} />
          )}
        </div>

        {/* Text */}
        <div className="space-y-2">
          {selectedCount !== null ? (
            <p className="text-blue-400 font-medium">
              {selectedCount} arquivo{selectedCount > 1 ? 's' : ''} selecionado{selectedCount > 1 ? 's' : ''}
            </p>
          ) : (
            <>
              <p className={cn(
                'font-medium',
                isDragOver && !disabled ? 'text-blue-400' : 'text-gray-300'
              )}>
                Arraste PDFs de provas aqui ou clique para selecionar
              </p>
              <p className="text-sm text-gray-500">
                Apenas arquivos PDF (max. {Math.round(maxFileSize / (1024 * 1024))}MB por arquivo)
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
