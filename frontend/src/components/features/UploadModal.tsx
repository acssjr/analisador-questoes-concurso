import { useState, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button, PulsingProgressBar } from '../ui';
import { api } from '../../services/api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string>('');
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const pdfFiles = droppedFiles.filter(f => f.type === 'application/pdf');

    if (pdfFiles.length > 0) {
      setFiles(prev => [...prev, ...pdfFiles]);
      setError('');
    } else {
      setError('Por favor, selecione apenas arquivos PDF');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    const pdfFiles = selectedFiles.filter(f => f.type === 'application/pdf');

    if (pdfFiles.length > 0) {
      setFiles(prev => [...prev, ...pdfFiles]);
      setError('');
    } else if (selectedFiles.length > 0) {
      setError('Por favor, selecione apenas arquivos PDF');
    }
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setError('');
    setProgressPercent(0);

    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i);
      const file = files[i];
      // Calculate base progress for this file (each file is a portion of total)
      const fileBaseProgress = (i / files.length) * 100;
      const fileProgressRange = 100 / files.length;

      setProgressText(`Enviando ${i + 1}/${files.length}: ${file.name}...`);
      setProgressPercent(Math.round(fileBaseProgress + fileProgressRange * 0.1));

      try {
        const result = await api.uploadPdf(file);
        setProgressText(`Processando ${i + 1}/${files.length}: ${file.name}...`);
        setProgressPercent(Math.round(fileBaseProgress + fileProgressRange * 0.2));

        // Poll para status do job
        let completed = false;
        while (!completed) {
          await new Promise(resolve => setTimeout(resolve, 2000));

          try {
            const status = await api.getJobStatus(result.job_id);

            if (status.status === 'completed') {
              completed = true;
              setProgressText(`Concluido ${i + 1}/${files.length}: ${file.name}`);
              setProgressPercent(Math.round(fileBaseProgress + fileProgressRange));
            } else if (status.status === 'failed') {
              setError(`Erro em ${file.name}: ${status.error || 'Erro no processamento'}`);
              setIsUploading(false);
              return;
            } else {
              const jobProgress = status.progress || 0;
              // Map job progress (0-100) to the file's portion of total progress
              const totalProgress = fileBaseProgress + (fileProgressRange * 0.2) + (fileProgressRange * 0.8 * (jobProgress / 100));
              setProgressPercent(Math.round(totalProgress));
              setProgressText(`Processando ${i + 1}/${files.length}: ${file.name}`);
            }
          } catch {
            setError(`Erro ao verificar status de ${file.name}`);
            setIsUploading(false);
            return;
          }
        }
      } catch {
        setError(`Erro ao fazer upload de ${file.name}`);
        setIsUploading(false);
        return;
      }
    }

    // Todos concluidos
    setProgressPercent(100);
    setProgressText(`Todos os ${files.length} PDFs processados com sucesso!`);
    setTimeout(() => {
      onUploadSuccess();
      handleClose();
    }, 1500);
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      setCurrentFileIndex(0);
      setProgressText('');
      setProgressPercent(0);
      setError('');
      onClose();
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar PDF de Prova" size="md">
      <div className="space-y-6">
        {/* Drag and drop area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center transition-all
            ${isDragging
              ? 'border-disciplinas-portugues bg-disciplinas-portugues bg-opacity-5'
              : 'border-dark-border hover:border-disciplinas-portugues hover:bg-disciplinas-portugues hover:bg-opacity-5'
            }
          `}
        >
          <div className="space-y-4">
            <div className="text-6xl">📄</div>
            <div>
              <p className="text-text-primary font-medium mb-2">
                Arraste PDFs aqui ou clique para selecionar
              </p>
              <p className="text-sm text-text-secondary">
                Formatos suportados: PDFs do PCI Concursos (múltiplos arquivos)
              </p>
            </div>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
              disabled={isUploading}
              multiple
            />
            <label htmlFor="file-input">
              <span className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed bg-dark-surface border border-dark-border hover:bg-opacity-80 text-text-primary px-4 py-2 text-sm cursor-pointer">
                Selecionar Arquivos
              </span>
            </label>
          </div>
        </div>

        {/* Selected files */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-text-primary">
              {files.length} arquivo{files.length > 1 ? 's' : ''} selecionado{files.length > 1 ? 's' : ''}
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className={`surface p-4 flex items-center justify-between ${
                    isUploading && index === currentFileIndex ? 'ring-2 ring-disciplinas-portugues' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{file.name}</p>
                      <p className="text-xs text-text-secondary">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  {!isUploading && (
                    <button
                      onClick={() => removeFile(index)}
                      className="text-semantic-error hover:text-opacity-80 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                  {isUploading && index < currentFileIndex && (
                    <span className="text-semantic-success">✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress */}
        {isUploading && (
          <div className="p-4 bg-semantic-info bg-opacity-10 border border-semantic-info rounded space-y-3">
            <PulsingProgressBar
              progress={progressPercent}
              variant={progressPercent >= 100 ? 'success' : 'info'}
              statusText={progressText}
              size="md"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-semantic-error bg-opacity-10 border border-semantic-error rounded">
            <p className="text-sm text-semantic-error">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose} disabled={isUploading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
          >
            {isUploading ? 'Processando...' : `Enviar ${files.length > 0 ? `(${files.length})` : ''}`}
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-xs text-text-secondary space-y-2 pt-4 border-t border-dark-border">
          <p className="font-medium">📋 Instruções:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Você pode selecionar múltiplos PDFs de uma vez</li>
            <li>PDFs do PCI Concursos são automaticamente reconhecidos</li>
            <li>O sistema extrai questões, gabaritos e detecta anulações</li>
            <li>Processamento leva de 2-5 minutos para 50 questões por PDF</li>
            <li>Os arquivos serão processados sequencialmente</li>
            <li>Você será notificado quando todos concluírem</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
