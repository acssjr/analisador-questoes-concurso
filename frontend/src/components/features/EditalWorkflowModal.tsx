import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../ui/Modal';
import { api } from '../../services/api';
import { useAppStore } from '../../store/appStore';
import {
  IconCheck,
  IconX,
  IconUpload,
  IconFileText,
  IconBookOpen,
  IconFolder,
  IconChevronRight,
  IconChevronDown,
  IconBuilding,
  IconCalendar,
  IconUsers,
  IconAlertTriangle,
  IconLoader,
} from '../ui/Icons';
import type {
  Edital,
  Questao,
  IncidenciaNode,
  EditalUploadResponse,
  ConteudoProgramaticoUploadResponse,
  DisciplinaConteudo,
  ItemConteudo,
} from '../../types';

interface EditalWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

type WorkflowStep = 1 | 2 | 3;

// Build incidence tree from questions
function buildIncidenciaTree(questoes: Questao[]): IncidenciaNode[] {
  const total = questoes.length;
  if (total === 0) return [];

  const porDisciplina = new Map<string, Questao[]>();

  for (const q of questoes) {
    const disciplina = q.classificacao?.disciplina || q.disciplina || 'Não classificada';
    if (!porDisciplina.has(disciplina)) {
      porDisciplina.set(disciplina, []);
    }
    porDisciplina.get(disciplina)!.push(q);
  }

  const tree: IncidenciaNode[] = [];

  for (const [disciplina, questoesDisciplina] of porDisciplina) {
    const disciplinaNode: IncidenciaNode = {
      nome: disciplina,
      count: questoesDisciplina.length,
      percentual: (questoesDisciplina.length / total) * 100,
      children: [],
      questoes: questoesDisciplina,
    };

    const porAssunto = new Map<string, Questao[]>();
    for (const q of questoesDisciplina) {
      const assunto = q.classificacao?.assunto || q.assunto_pci || 'Sem assunto';
      if (!porAssunto.has(assunto)) {
        porAssunto.set(assunto, []);
      }
      porAssunto.get(assunto)!.push(q);
    }

    for (const [assunto, questoesAssunto] of porAssunto) {
      disciplinaNode.children!.push({
        nome: assunto,
        count: questoesAssunto.length,
        percentual: (questoesAssunto.length / total) * 100,
        questoes: questoesAssunto,
      });
    }

    disciplinaNode.children!.sort((a, b) => b.count - a.count);
    tree.push(disciplinaNode);
  }

  tree.sort((a, b) => b.count - a.count);
  return tree;
}

// Step indicator component
function StepIndicator({
  step,
  currentStep,
  label,
}: {
  step: number;
  currentStep: number;
  label: string;
}) {
  const isActive = currentStep === step;
  const isComplete = currentStep > step;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-all
          ${isComplete
            ? 'bg-[var(--accent-green)] text-white'
            : isActive
            ? 'bg-[rgba(27,67,50,0.15)] text-[var(--accent-green)] ring-2 ring-[var(--accent-green)]'
            : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'
          }
        `}
      >
        {isComplete ? <IconCheck size={14} /> : step}
      </div>
      <span
        className={`text-[13px] ${
          isActive ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// Cargo selector component with card-style options
function CargoSelector({
  cargos,
  selectedCargo,
  onCargoSelect,
}: {
  cargos: string[];
  selectedCargo: string | null;
  onCargoSelect: (cargo: string) => void;
}) {
  if (cargos.length <= 5) {
    // Card-style for few options
    return (
      <div className="cargo-selector scrollbar-custom">
        {cargos.map((cargo, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onCargoSelect(cargo)}
            className={`cargo-option ${selectedCargo === cargo ? 'selected' : ''}`}
          >
            {cargo}
          </button>
        ))}
      </div>
    );
  }

  // Styled select for many options
  return (
    <select
      value={selectedCargo || ''}
      onChange={(e) => onCargoSelect(e.target.value)}
      className="select-custom"
    >
      <option value="">-- Selecione um cargo --</option>
      {cargos.map((cargo, idx) => (
        <option key={idx} value={cargo}>
          {cargo}
        </option>
      ))}
    </select>
  );
}

// Edital preview component
function EditalPreview({
  data,
  selectedCargo,
  onCargoSelect,
}: {
  data: EditalUploadResponse;
  selectedCargo: string | null;
  onCargoSelect: (cargo: string) => void;
}) {
  const hasMultipleCargos = data.cargos && data.cargos.length > 1;

  return (
    <div className="card p-5 border-l-4 border-l-[var(--accent-green)]">
      <div className="flex items-center gap-2 text-[var(--accent-green)] mb-4">
        <IconCheck size={18} />
        <span className="text-[14px] font-medium">Informacoes extraidas do edital</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-[13px] mb-4">
        <div>
          <span className="text-[var(--text-tertiary)]">Nome:</span>
          <p className="text-[var(--text-primary)] font-medium">{data.nome}</p>
        </div>
        {data.banca && (
          <div className="flex items-center gap-2">
            <IconBuilding size={14} className="text-[var(--text-muted)]" />
            <div>
              <span className="text-[var(--text-tertiary)]">Banca:</span>
              <p className="text-[var(--text-primary)] font-medium">{data.banca}</p>
            </div>
          </div>
        )}
        {data.ano && (
          <div className="flex items-center gap-2">
            <IconCalendar size={14} className="text-[var(--text-muted)]" />
            <div>
              <span className="text-[var(--text-tertiary)]">Ano:</span>
              <p className="text-[var(--text-primary)] font-medium">{data.ano}</p>
            </div>
          </div>
        )}
      </div>

      {/* Cargo selection */}
      {data.cargos && data.cargos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <IconUsers size={14} className="text-[var(--text-muted)]" />
            <span className="text-[13px] text-[var(--text-tertiary)]">
              {hasMultipleCargos ? 'Selecione seu cargo:' : 'Cargo:'}
            </span>
          </div>
          {hasMultipleCargos ? (
            <CargoSelector
              cargos={data.cargos}
              selectedCargo={selectedCargo}
              onCargoSelect={onCargoSelect}
            />
          ) : (
            <p className="text-[var(--text-primary)] font-medium text-[13px]">{data.cargos[0]}</p>
          )}
        </div>
      )}

      {data.disciplinas && data.disciplinas.length > 0 && (
        <div className="mt-4">
          <span className="text-[13px] text-[var(--text-tertiary)]">Disciplinas identificadas:</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.disciplinas.map((disc, idx) => (
              <span key={idx} className="badge badge-muted text-[11px]">
                {disc}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Recursive item renderer for taxonomy
function RecursiveItemRenderer({
  item,
  itemKey,
  depth,
  expandedItems,
  toggleItem,
}: {
  item: ItemConteudo;
  itemKey: string;
  depth: number;
  expandedItems: Set<string>;
  toggleItem: (key: string) => void;
}) {
  const hasChildren = item.filhos && item.filhos.length > 0;
  const isExpanded = expandedItems.has(itemKey);

  const displayId = item.id ? `${item.id}. ` : '';

  if (!hasChildren) {
    return (
      <div className="taxonomy-leaf">
        <span className="taxonomy-leaf-marker" />
        <span>
          {displayId}
          {item.texto}
        </span>
      </div>
    );
  }

  return (
    <div className="taxonomy-tree">
      <button
        onClick={() => toggleItem(itemKey)}
        className="taxonomy-item-button"
      >
        <span className="taxonomy-chevron">
          {isExpanded ? (
            <IconChevronDown size={12} />
          ) : (
            <IconChevronRight size={12} />
          )}
        </span>
        <span className="flex-1 text-[13px]">
          {displayId}
          {item.texto}
        </span>
        <span className="taxonomy-count">{item.filhos.length}</span>
      </button>

      {isExpanded && (
        <div className="taxonomy-children">
          {item.filhos.map((filho, idx) => (
            <RecursiveItemRenderer
              key={idx}
              item={filho}
              itemKey={`${itemKey}-${idx}`}
              depth={depth + 1}
              expandedItems={expandedItems}
              toggleItem={toggleItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Count total items recursively
function countTotalItems(itens: ItemConteudo[]): number {
  let total = 0;
  for (const item of itens) {
    total += 1;
    if (item.filhos && item.filhos.length > 0) {
      total += countTotalItems(item.filhos);
    }
  }
  return total;
}

// Taxonomy preview component
function TaxonomyPreview({ data }: { data: ConteudoProgramaticoUploadResponse }) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const disciplinas = data.taxonomia?.disciplinas || [];

  const totalDisciplinas = disciplinas.length;
  const totalItens = disciplinas.reduce((acc, disc) => {
    if (disc.itens) {
      return acc + countTotalItems(disc.itens);
    }
    return acc + (disc.assuntos?.length || 0);
  }, 0);

  return (
    <div className="card p-5 border-l-4 border-l-[var(--accent-green)]">
      <div className="flex items-center gap-2 text-[var(--accent-green)] mb-4">
        <IconCheck size={18} />
        <span className="text-[14px] font-medium">Conteudo Programatico extraido</span>
      </div>

      <div className="flex gap-6 mb-4">
        <div className="text-center">
          <p className="text-[24px] font-semibold text-[var(--accent-green)] text-mono">
            {totalDisciplinas}
          </p>
          <p className="text-[12px] text-[var(--text-tertiary)]">Disciplinas</p>
        </div>
        <div className="text-center">
          <p className="text-[24px] font-semibold text-[var(--accent-amber)] text-mono">
            {totalItens}
          </p>
          <p className="text-[12px] text-[var(--text-tertiary)]">Itens</p>
        </div>
      </div>

      {disciplinas.length > 0 && (
        <div className="max-h-64 overflow-y-auto scrollbar-custom taxonomy-tree">
          {disciplinas.map((disc: DisciplinaConteudo, dIdx: number) => {
            const discKey = `d-${dIdx}`;
            const isDiscExpanded = expandedItems.has(discKey);

            const hasItens = disc.itens && disc.itens.length > 0;
            const itemCount = hasItens ? disc.itens.length : (disc.assuntos?.length || 0);

            return (
              <div key={dIdx}>
                <button
                  onClick={() => toggleItem(discKey)}
                  className="taxonomy-item-button"
                >
                  <span className="taxonomy-chevron">
                    {isDiscExpanded ? (
                      <IconChevronDown size={12} />
                    ) : (
                      <IconChevronRight size={12} />
                    )}
                  </span>
                  <span className="flex-1 text-[var(--text-primary)] font-medium">{disc.nome}</span>
                  <span className="taxonomy-count">
                    {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                  </span>
                </button>

                {isDiscExpanded && hasItens && (
                  <div className="taxonomy-children">
                    {disc.itens.map((item, iIdx) => (
                      <RecursiveItemRenderer
                        key={iIdx}
                        item={item}
                        itemKey={`${discKey}-i-${iIdx}`}
                        depth={0}
                        expandedItems={expandedItems}
                        toggleItem={toggleItem}
                      />
                    ))}
                  </div>
                )}

                {isDiscExpanded && !hasItens && disc.assuntos && (
                  <div className="taxonomy-children">
                    {disc.assuntos.map((assunto, aIdx) => (
                      <div key={aIdx} className="taxonomy-leaf">
                        <span className="taxonomy-leaf-marker" />
                        <span>{assunto.nome}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Extraction results preview
function ExtractionResultsPreview({
  results,
}: {
  results: Array<{
    success: boolean;
    filename: string;
    format?: string;
    total_questoes?: number;
    error?: string;
  }>;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] font-medium text-[var(--text-primary)]">Resultados da extração:</p>
      <div className="max-h-48 overflow-y-auto space-y-2 scrollbar-custom">
        {results.map((result, idx) => (
          <div
            key={idx}
            className={`card p-4 flex items-center justify-between border-l-4 ${
              result.success ? 'border-l-[var(--accent-green)]' : 'border-l-[var(--accent-red)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  result.success
                    ? 'bg-[var(--accent-green)] bg-opacity-10'
                    : 'bg-[var(--accent-red)] bg-opacity-10'
                }`}
              >
                {result.success ? (
                  <IconCheck size={16} className="text-[var(--accent-green)]" />
                ) : (
                  <IconX size={16} className="text-[var(--accent-red)]" />
                )}
              </div>
              <div>
                <p className="text-[13px] font-medium text-[var(--text-primary)]">
                  {result.filename}
                </p>
                {result.success ? (
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    Formato: {result.format} • {result.total_questoes || 0} questões extraídas
                  </p>
                ) : (
                  <p className="text-[11px] text-[var(--accent-red)]">
                    {result.error || 'Erro desconhecido'}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Drop zone component
function DropZone({
  onDrop,
  onFileSelect,
  isDragging,
  setIsDragging,
  icon: Icon,
  title,
  subtitle,
  inputId,
  multiple = false,
  disabled = false,
}: {
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isDragging: boolean;
  setIsDragging: (value: boolean) => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle: string;
  inputId: string;
  multiple?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={onDrop}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center transition-all
        ${isDragging
          ? 'border-[var(--accent-green)] bg-[var(--accent-green)] bg-opacity-5'
          : 'border-[var(--border-default)] hover:border-[var(--accent-green)] hover:bg-[var(--bg-subtle)]'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <div className="space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mx-auto">
          <Icon size={28} className="text-[var(--accent-green)]" />
        </div>
        <div>
          <p className="text-[14px] font-medium text-[var(--text-primary)] mb-1">{title}</p>
          <p className="text-[12px] text-[var(--text-tertiary)]">{subtitle}</p>
        </div>
        <input
          type="file"
          accept="application/pdf"
          onChange={onFileSelect}
          className="hidden"
          id={inputId}
          disabled={disabled}
          multiple={multiple}
        />
        <label htmlFor={inputId}>
          <span
            className={`btn btn-secondary text-[13px] ${disabled ? 'pointer-events-none' : 'cursor-pointer'}`}
          >
            <IconUpload size={14} />
            Selecionar Arquivo{multiple ? 's' : ''}
          </span>
        </label>
      </div>
    </div>
  );
}

export function EditalWorkflowModal({
  isOpen,
  onClose,
  onUploadSuccess,
}: EditalWorkflowModalProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  const [, setEditalFile] = useState<File | null>(null);
  const [conteudoProgramaticoFile, setConteudoProgramaticoFile] = useState<File | null>(null);
  const [provasFiles, setProvasFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Extracted data states
  const [extractedEdital, setExtractedEdital] = useState<EditalUploadResponse | null>(null);
  const [extractedTaxonomy, setExtractedTaxonomy] =
    useState<ConteudoProgramaticoUploadResponse | null>(null);
  const [extractionResults, setExtractionResults] = useState<
    Array<{
      success: boolean;
      filename: string;
      format?: string;
      total_questoes?: number;
      questoes?: Questao[];
      metadados?: Record<string, unknown>;
      error?: string;
    }> | null
  >(null);

  const [selectedCargo, setSelectedCargo] = useState<string | null>(null);

  // Store actions
  const setActiveEdital = useAppStore((state) => state.setActiveEdital);
  const setQuestoes = useAppStore((state) => state.setQuestoes);
  const setIncidencia = useAppStore((state) => state.setIncidencia);

  // Auto-select cargo if only one
  useEffect(() => {
    if (extractedEdital?.cargos?.length === 1) {
      setSelectedCargo(extractedEdital.cargos[0]);
    }
  }, [extractedEdital]);

  // Upload edital
  const uploadEdital = useCallback(async (file: File) => {
    setIsUploading(true);
    setProgress('Extraindo informações do edital...');
    setError('');

    try {
      const result = await api.uploadEdital(file);
      setExtractedEdital(result);
      setProgress('');
    } catch {
      setError('Erro ao fazer upload do edital');
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Upload conteúdo programático
  const uploadConteudo = useCallback(
    async (file: File) => {
      if (!extractedEdital) return;

      setIsUploading(true);
      setProgress('Extraindo conteúdo programático...');
      setError('');

      try {
        const result = await api.uploadConteudoProgramatico(
          extractedEdital.edital_id,
          file,
          selectedCargo || undefined
        );
        setExtractedTaxonomy(result);
        setProgress('');
      } catch {
        setError('Erro ao fazer upload do conteúdo programático');
      } finally {
        setIsUploading(false);
      }
    },
    [extractedEdital, selectedCargo]
  );

  // Upload provas
  const uploadProvas = useCallback(
    async (files: File[]) => {
      if (!extractedEdital || files.length === 0) return;

      setIsUploading(true);
      setProgress(`Extraindo questões de ${files.length} prova(s)...`);
      setError('');

      try {
        const result = await api.uploadProvasVinculadas(extractedEdital.edital_id, files);
        setExtractionResults(result.results);
        setProgress('');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao fazer upload das provas';
        setError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [extractedEdital]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, step: WorkflowStep) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      const pdfFiles = droppedFiles.filter((f) => f.type === 'application/pdf');

      if (pdfFiles.length === 0) {
        setError('Por favor, selecione apenas arquivos PDF');
        return;
      }

      setError('');

      if (step === 1 && pdfFiles.length > 0) {
        setEditalFile(pdfFiles[0]);
        setExtractedEdital(null);
        setSelectedCargo(null);
        uploadEdital(pdfFiles[0]);
      } else if (step === 2 && pdfFiles.length > 0) {
        setConteudoProgramaticoFile(pdfFiles[0]);
        setExtractedTaxonomy(null);
        uploadConteudo(pdfFiles[0]);
      } else if (step === 3) {
        const newFiles = [...provasFiles, ...pdfFiles];
        setProvasFiles(newFiles);
        setExtractionResults(null);
        uploadProvas(newFiles);
      }
    },
    [provasFiles, uploadEdital, uploadConteudo, uploadProvas]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, step: WorkflowStep) => {
      const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
      const pdfFiles = selectedFiles.filter((f) => f.type === 'application/pdf');

      if (pdfFiles.length === 0 && selectedFiles.length > 0) {
        setError('Por favor, selecione apenas arquivos PDF');
        return;
      }

      setError('');

      if (step === 1 && pdfFiles.length > 0) {
        setEditalFile(pdfFiles[0]);
        setExtractedEdital(null);
        setSelectedCargo(null);
        uploadEdital(pdfFiles[0]);
      } else if (step === 2 && pdfFiles.length > 0) {
        setConteudoProgramaticoFile(pdfFiles[0]);
        setExtractedTaxonomy(null);
        uploadConteudo(pdfFiles[0]);
      } else if (step === 3) {
        const newFiles = [...provasFiles, ...pdfFiles];
        setProvasFiles(newFiles);
        setExtractionResults(null);
        uploadProvas(newFiles);
      }

      e.target.value = '';
    },
    [provasFiles, uploadEdital, uploadConteudo, uploadProvas]
  );

  const handleNext = () => {
    if (currentStep === 1 && extractedEdital) {
      if (extractedEdital.cargos?.length > 1 && !selectedCargo) {
        setError('Por favor, selecione um cargo antes de continuar');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleFinish = async () => {
    if (!extractedEdital || !extractionResults) return;

    const questoesExtraidas: Questao[] = (extractionResults || [])
      .filter((r) => r.success && r.questoes)
      .flatMap((r) =>
        r.questoes!.map((q, idx: number) => ({
          id: String(q.id || `${r.filename}-${idx}`),
          numero: Number(q.numero) || idx + 1,
          ano: Number(q.ano) || Number(r.metadados?.ano) || new Date().getFullYear(),
          banca: String(q.banca || r.metadados?.banca || extractedEdital.banca || 'Desconhecida'),
          cargo: String(q.cargo || r.metadados?.cargo || selectedCargo || ''),
          disciplina: String(q.disciplina || 'Não classificada'),
          // Backend may return 'assunto' field that maps to 'assunto_pci' in frontend
          assunto_pci: String(q.assunto_pci || (q as unknown as Record<string, unknown>).assunto || ''),
          enunciado: String(q.enunciado || ''),
          alternativas: (q.alternativas || { A: '', B: '', C: '', D: '', E: '' }) as Questao['alternativas'],
          gabarito: String(q.gabarito || ''),
          anulada: Boolean(q.anulada),
          motivo_anulacao: q.motivo_anulacao as string | undefined,
          classificacao: q.classificacao as Questao['classificacao'],
        }))
      );

    const totalQuestoes = extractionResults.reduce((acc, r) => acc + (r.total_questoes || 0), 0);
    const totalProvas = extractionResults.filter((r) => r.success).length;

    // Create a project in the backend
    try {
      const projeto = await api.createProjeto({
        nome: extractedEdital.nome,
        banca: extractedEdital.banca,
        cargo: selectedCargo || undefined,
        ano: extractedEdital.ano,
      });

      // Link the edital to the project
      await api.vincularEdital(projeto.id, extractedEdital.edital_id);
    } catch (err) {
      console.error('Erro ao criar projeto:', err);
      // Continue anyway - the UI will still work
    }

    const editalAtivo: Edital = {
      id: extractedEdital.edital_id,
      nome: extractedEdital.nome,
      arquivo_url: '',
      data_upload: new Date().toISOString(),
      total_provas: totalProvas,
      total_questoes: totalQuestoes,
      banca: extractedEdital.banca,
      ano: extractedEdital.ano,
      cargos: extractedEdital.cargos,
      conteudo_programatico: extractedTaxonomy?.taxonomia,
    };

    const incidenciaTree = buildIncidenciaTree(questoesExtraidas);

    setActiveEdital(editalAtivo);
    setQuestoes(questoesExtraidas);
    setIncidencia(incidenciaTree);

    onUploadSuccess();
    handleClose();
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
      setExtractedEdital(null);
      setExtractedTaxonomy(null);
      setExtractionResults(null);
      setSelectedCargo(null);
      setProgress('');
      setError('');
      onClose();
    }
  };

  const canProceed = () => {
    if (currentStep === 1) {
      if (!extractedEdital) return false;
      if (extractedEdital.cargos?.length > 1 && !selectedCargo) return false;
      return true;
    }
    if (currentStep === 2) return true;
    if (currentStep === 3)
      return extractionResults !== null && extractionResults.some((r) => r.success);
    return false;
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Edital e Provas" size="lg">
      <div className="space-y-6">
        {/* Step indicators */}
        <div className="flex items-center justify-between px-4">
          <StepIndicator step={1} currentStep={currentStep} label="Edital" />
          <div className="flex-1 h-px bg-[var(--border-subtle)] mx-4" />
          <StepIndicator step={2} currentStep={currentStep} label="Conteúdo" />
          <div className="flex-1 h-px bg-[var(--border-subtle)] mx-4" />
          <StepIndicator step={3} currentStep={currentStep} label="Provas" />
        </div>

        {/* Step 1: Upload Edital */}
        {currentStep === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
                Upload do Edital
              </h3>
              <p className="text-[13px] text-[var(--text-tertiary)]">
                Faça upload do PDF do edital. A extração inicia automaticamente.
              </p>
            </div>

            {!extractedEdital && !isUploading && (
              <DropZone
                onDrop={(e) => handleDrop(e, 1)}
                onFileSelect={(e) => handleFileSelect(e, 1)}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
                icon={IconFileText}
                title="Arraste o PDF do edital aqui"
                subtitle="A extração inicia automaticamente após selecionar o arquivo"
                inputId="edital-input"
                disabled={isUploading}
              />
            )}

            {extractedEdital && (
              <EditalPreview
                data={extractedEdital}
                selectedCargo={selectedCargo}
                onCargoSelect={setSelectedCargo}
              />
            )}
          </motion.div>
        )}

        {/* Step 2: Upload Conteúdo Programático */}
        {currentStep === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
                Conteúdo Programático{' '}
                <span className="text-[var(--text-muted)] font-normal">(Opcional)</span>
              </h3>
              <p className="text-[13px] text-[var(--text-tertiary)]">
                Faça upload do PDF com o conteúdo programático.
                {selectedCargo && (
                  <span className="text-[var(--accent-green)]"> Cargo: {selectedCargo}</span>
                )}
              </p>
            </div>

            {!extractedTaxonomy && !isUploading && (
              <DropZone
                onDrop={(e) => handleDrop(e, 2)}
                onFileSelect={(e) => handleFileSelect(e, 2)}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
                icon={IconBookOpen}
                title="Arraste o conteúdo programático aqui"
                subtitle="A extração inicia automaticamente (opcional)"
                inputId="conteudo-input"
                disabled={isUploading}
              />
            )}

            {extractedTaxonomy && <TaxonomyPreview data={extractedTaxonomy} />}
          </motion.div>
        )}

        {/* Step 3: Upload Provas */}
        {currentStep === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
                Upload das Provas
              </h3>
              <p className="text-[13px] text-[var(--text-tertiary)]">
                Faça upload dos PDFs das provas. A extração inicia automaticamente.
              </p>
            </div>

            {!extractionResults && !isUploading && (
              <DropZone
                onDrop={(e) => handleDrop(e, 3)}
                onFileSelect={(e) => handleFileSelect(e, 3)}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
                icon={IconFolder}
                title="Arraste os PDFs das provas aqui"
                subtitle="Formatos suportados: PDFs do PCI Concursos"
                inputId="provas-input"
                multiple
                disabled={isUploading}
              />
            )}

            {extractionResults && <ExtractionResultsPreview results={extractionResults} />}

            {extractionResults && (
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setExtractionResults(null);
                    setProvasFiles([]);
                  }}
                  className="btn btn-ghost text-[13px]"
                >
                  Selecionar outros arquivos
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Progress */}
        {progress && (
          <div className="p-4 bg-[var(--accent-green)] bg-opacity-5 border border-[var(--accent-green)] border-opacity-20 rounded-xl space-y-3">
            <div className="flex items-center gap-3">
              <IconLoader size={18} className="text-[var(--accent-green)] animate-spin" />
              <p className="text-[13px] text-[var(--accent-green)] font-medium">{progress}</p>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-indeterminate" />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-[var(--accent-red)] bg-opacity-5 border border-[var(--accent-red)] border-opacity-20 rounded-xl flex items-center gap-3">
            <IconAlertTriangle size={18} className="text-[var(--accent-red)]" />
            <p className="text-[13px] text-[var(--accent-red)]">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-4 border-t border-[var(--border-subtle)]">
          <div>
            {currentStep > 1 && (
              <button onClick={handleBack} disabled={isUploading} className="btn btn-ghost">
                Voltar
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleClose} disabled={isUploading} className="btn btn-secondary">
              Cancelar
            </button>

            <button
              onClick={currentStep === 3 ? handleFinish : handleNext}
              disabled={!canProceed() || isUploading}
              className="btn btn-primary"
            >
              {currentStep === 3
                ? 'Finalizar'
                : currentStep === 2 && !conteudoProgramaticoFile
                ? 'Pular'
                : 'Próximo'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-[12px] text-[var(--text-muted)] space-y-2 pt-4 border-t border-[var(--border-subtle)]">
          <p className="font-medium text-[var(--text-tertiary)]">Fluxo de trabalho:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>Passo 1:</strong> Upload do edital → Selecione seu cargo (se houver vários) →
              Próximo
            </li>
            <li>
              <strong>Passo 2:</strong> Upload do conteúdo programático (opcional) → Próximo
            </li>
            <li>
              <strong>Passo 3:</strong> Upload das provas → Finalizar
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
