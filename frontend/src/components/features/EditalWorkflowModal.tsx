import { useState, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button, Badge } from '../ui';
import { api } from '../../services/api';

interface EditalWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

type WorkflowStep = 1 | 2 | 3;

export function EditalWorkflowModal({ isOpen, onClose, onUploadSuccess }: EditalWorkflowModalProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  const [editalFile, setEditalFile] = useState<File | null>(null);
  const [conteudoProgramaticoFile, setConteudoProgramaticoFile] = useState<File | null>(null);
  const [provasFiles, setProvasFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [editalId, setEditalId] = useState<string>('');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, step: WorkflowStep) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const pdfFiles = droppedFiles.filter(f => f.type === 'application/pdf');

    if (pdfFiles.length === 0) {
      setError('Por favor, selecione apenas arquivos PDF');
      return;
    }

    setError('');

    if (step === 1 && pdfFiles.length > 0) {
      setEditalFile(pdfFiles[0]);
    } else if (step === 2 && pdfFiles.length > 0) {
      setConteudoProgramaticoFile(pdfFiles[0]);
    } else if (step === 3) {
      setProvasFiles(prev => [...prev, ...pdfFiles]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, step: WorkflowStep) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    const pdfFiles = selectedFiles.filter(f => f.type === 'application/pdf');

    if (pdfFiles.length === 0 && selectedFiles.length > 0) {
      setError('Por favor, selecione apenas arquivos PDF');
      return;
    }

    setError('');

    if (step === 1 && pdfFiles.length > 0) {
      setEditalFile(pdfFiles[0]);
    } else if (step === 2 && pdfFiles.length > 0) {
      setConteudoProgramaticoFile(pdfFiles[0]);
    } else if (step === 3) {
      setProvasFiles(prev => [...prev, ...pdfFiles]);
    }
  }, []);

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!editalFile) {
        setError('Por favor, selecione o arquivo do edital');
        return;
      }

      // Upload do edital
      setIsUploading(true);
      setProgress('Enviando edital...');
      setError('');

      try {
        const result = await api.uploadEdital(editalFile);
        setEditalId(result.edital_id);
        setProgress('Edital enviado com sucesso!');
        setTimeout(() => {
          setProgress('');
          setIsUploading(false);
          setCurrentStep(2);
        }, 1000);
      } catch (err) {
        setError('Erro ao fazer upload do edital');
        setIsUploading(false);
      }
    } else if (currentStep === 2) {
      // Upload do conteúdo programático (opcional)
      if (conteudoProgramaticoFile) {
        setIsUploading(true);
        setProgress('Enviando conteúdo programático...');
        setError('');

        try {
          await api.uploadConteudoProgramatico(editalId, conteudoProgramaticoFile);
          setProgress('Conteúdo programático enviado com sucesso!');
          setTimeout(() => {
            setProgress('');
            setIsUploading(false);
            setCurrentStep(3);
          }, 1000);
        } catch (err) {
          setError('Erro ao fazer upload do conteúdo programático');
          setIsUploading(false);
        }
      } else {
        // Pular para próximo passo se não houver conteúdo programático
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      if (provasFiles.length === 0) {
        setError('Por favor, selecione ao menos um PDF de prova');
        return;
      }

      // Upload das provas
      setIsUploading(true);
      setProgress(`Enviando ${provasFiles.length} prova(s)...`);
      setError('');

      try {
        const result = await api.uploadProvasVinculadas(editalId, provasFiles);

        // Backend processa síncronamente e retorna resultado imediato
        if (result.success) {
          setProgress(
            `✅ Upload concluído!\n` +
            `${result.successful_files}/${result.total_files} prova(s) processada(s)\n` +
            `${result.total_questoes} questões extraídas`
          );
          setIsUploading(false);

          setTimeout(() => {
            onUploadSuccess();
            handleClose();
          }, 3000);
        } else {
          setError(`${result.failed_files} prova(s) falharam no processamento`);
          setIsUploading(false);
        }
      } catch (err: any) {
        setError(err?.message || 'Erro ao fazer upload das provas');
        setIsUploading(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WorkflowStep);
      setError('');
      setProgress('');
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setCurrentStep(1);
      setEditalFile(null);
      setConteudoProgramaticoFile(null);
      setProvasFiles([]);
      setEditalId('');
      setProgress('');
      setError('');
      onClose();
    }
  };

  const removeProvaFile = (index: number) => {
    setProvasFiles(prev => prev.filter((_, i) => i !== index));
  };

  const canProceed = () => {
    if (currentStep === 1) return editalFile !== null;
    if (currentStep === 2) return true; // Opcional
    if (currentStep === 3) return provasFiles.length > 0;
    return false;
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Edital e Provas" size="lg">
      <div className="space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                  currentStep === step
                    ? 'border-disciplinas-portugues bg-disciplinas-portugues bg-opacity-20 text-disciplinas-portugues'
                    : currentStep > step
                    ? 'border-semantic-success bg-semantic-success bg-opacity-20 text-semantic-success'
                    : 'border-dark-border text-text-secondary'
                }`}
              >
                {currentStep > step ? '✓' : step}
              </div>
              {step < 3 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-all ${
                    currentStep > step ? 'bg-semantic-success' : 'bg-dark-border'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="text-center">
          <Badge variant="info" className="text-xs">
            Passo {currentStep} de 3
          </Badge>
        </div>

        {/* Step 1: Upload Edital */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-text-primary mb-2">Upload do Edital</h3>
              <p className="text-sm text-text-secondary">
                Faça upload do PDF do edital do concurso. Este arquivo contém as informações oficiais sobre o certame.
              </p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 1)}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-all
                ${isDragging
                  ? 'border-disciplinas-portugues bg-disciplinas-portugues bg-opacity-5'
                  : 'border-dark-border hover:border-disciplinas-portugues hover:bg-disciplinas-portugues hover:bg-opacity-5'
                }
              `}
            >
              <div className="space-y-4">
                <div className="text-6xl">📋</div>
                <div>
                  <p className="text-text-primary font-medium mb-2">
                    Arraste o PDF do edital aqui ou clique para selecionar
                  </p>
                  <p className="text-sm text-text-secondary">
                    Apenas arquivos PDF
                  </p>
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handleFileSelect(e, 1)}
                  className="hidden"
                  id="edital-input"
                  disabled={isUploading}
                />
                <label htmlFor="edital-input">
                  <span className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed bg-dark-surface border border-dark-border hover:bg-opacity-80 text-text-primary px-4 py-2 text-sm cursor-pointer">
                    Selecionar Edital
                  </span>
                </label>
              </div>
            </div>

            {editalFile && (
              <div className="surface p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{editalFile.name}</p>
                    <p className="text-xs text-text-secondary">
                      {(editalFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {!isUploading && (
                  <button
                    onClick={() => setEditalFile(null)}
                    className="text-semantic-error hover:text-opacity-80 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Upload Conteúdo Programático */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-text-primary mb-2">
                Conteúdo Programático <span className="text-text-secondary text-sm">(Opcional)</span>
              </h3>
              <p className="text-sm text-text-secondary">
                Faça upload do PDF com o conteúdo programático detalhado. Este arquivo ajuda a melhorar a classificação das questões.
              </p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 2)}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-all
                ${isDragging
                  ? 'border-disciplinas-portugues bg-disciplinas-portugues bg-opacity-5'
                  : 'border-dark-border hover:border-disciplinas-portugues hover:bg-disciplinas-portugues hover:bg-opacity-5'
                }
              `}
            >
              <div className="space-y-4">
                <div className="text-6xl">📚</div>
                <div>
                  <p className="text-text-primary font-medium mb-2">
                    Arraste o conteúdo programático aqui ou clique para selecionar
                  </p>
                  <p className="text-sm text-text-secondary">
                    Apenas arquivos PDF (opcional)
                  </p>
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handleFileSelect(e, 2)}
                  className="hidden"
                  id="conteudo-input"
                  disabled={isUploading}
                />
                <label htmlFor="conteudo-input">
                  <span className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed bg-dark-surface border border-dark-border hover:bg-opacity-80 text-text-primary px-4 py-2 text-sm cursor-pointer">
                    Selecionar Arquivo
                  </span>
                </label>
              </div>
            </div>

            {conteudoProgramaticoFile && (
              <div className="surface p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📚</span>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{conteudoProgramaticoFile.name}</p>
                    <p className="text-xs text-text-secondary">
                      {(conteudoProgramaticoFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {!isUploading && (
                  <button
                    onClick={() => setConteudoProgramaticoFile(null)}
                    className="text-semantic-error hover:text-opacity-80 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Upload Provas */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-text-primary mb-2">Upload das Provas</h3>
              <p className="text-sm text-text-secondary">
                Faça upload dos PDFs das provas vinculadas a este edital. Você pode selecionar múltiplos arquivos.
              </p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 3)}
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
                    Arraste os PDFs das provas aqui ou clique para selecionar
                  </p>
                  <p className="text-sm text-text-secondary">
                    Formatos suportados: PDFs do PCI Concursos (múltiplos arquivos)
                  </p>
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handleFileSelect(e, 3)}
                  className="hidden"
                  id="provas-input"
                  disabled={isUploading}
                  multiple
                />
                <label htmlFor="provas-input">
                  <span className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed bg-dark-surface border border-dark-border hover:bg-opacity-80 text-text-primary px-4 py-2 text-sm cursor-pointer">
                    Selecionar Provas
                  </span>
                </label>
              </div>
            </div>

            {provasFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-text-primary">
                  {provasFiles.length} prova{provasFiles.length > 1 ? 's' : ''} selecionada{provasFiles.length > 1 ? 's' : ''}
                </p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {provasFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="surface p-4 flex items-center justify-between"
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
                          onClick={() => removeProvaFile(index)}
                          className="text-semantic-error hover:text-opacity-80 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {progress && (
          <div className="p-4 bg-semantic-info bg-opacity-10 border border-semantic-info rounded">
            <p className="text-sm text-semantic-info">{progress}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-semantic-error bg-opacity-10 border border-semantic-error rounded">
            <p className="text-sm text-semantic-error">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between gap-3">
          <div>
            {currentStep > 1 && (
              <Button variant="ghost" onClick={handleBack} disabled={isUploading}>
                Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleClose} disabled={isUploading}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canProceed() || isUploading}
            >
              {isUploading
                ? 'Processando...'
                : currentStep === 3
                ? 'Finalizar'
                : currentStep === 2
                ? conteudoProgramaticoFile
                  ? 'Próximo'
                  : 'Pular'
                : 'Próximo'}
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-xs text-text-secondary space-y-2 pt-4 border-t border-dark-border">
          <p className="font-medium">Instruções:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Passo 1: Faça upload do PDF do edital do concurso</li>
            <li>Passo 2: Opcionalmente, adicione o conteúdo programático detalhado</li>
            <li>Passo 3: Adicione os PDFs das provas vinculadas a este edital</li>
            <li>PDFs do PCI Concursos são automaticamente reconhecidos</li>
            <li>O sistema extrai questões, gabaritos e detecta anulações</li>
            <li>Processamento leva de 2-5 minutos para 50 questões por PDF</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
