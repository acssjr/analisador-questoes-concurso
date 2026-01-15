import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Modal } from '../ui/Modal';
import { UploadProgress } from '../ui/UploadProgress';
import type { UploadStatus } from '../ui/UploadProgress';
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

interface ProjetoWorkflowModalProps {
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

// Step indicator component - Improved design
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
    <div className="flex items-center gap-2">
      <div
        className={`
          w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold
          transition-all duration-300 ease-out
          ${isComplete
            ? 'bg-[var(--accent-green)] text-white shadow-lg shadow-[var(--accent-green)]/30'
            : isActive
            ? 'bg-[var(--accent-green)]/15 text-[var(--accent-green)] ring-2 ring-[var(--accent-green)] ring-offset-2 ring-offset-[var(--bg-elevated)]'
            : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
          }
        `}
      >
        {isComplete ? <IconCheck size={16} strokeWidth={3} /> : step}
      </div>
      <span
        className={`text-[13px] font-medium transition-colors duration-300 ${
          isActive || isComplete ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// Cargo selector component
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
    return (
      <div className="grid gap-2">
        {cargos.map((cargo, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onCargoSelect(cargo)}
            className={`
              p-3 rounded-lg text-left text-[13px] font-medium transition-all duration-200
              ${selectedCargo === cargo
                ? 'bg-[var(--accent-green)] text-white shadow-lg'
                : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-muted)] border border-[var(--border-subtle)]'
              }
            `}
          >
            {cargo}
          </button>
        ))}
      </div>
    );
  }

  return (
    <select
      value={selectedCargo || ''}
      onChange={(e) => onCargoSelect(e.target.value)}
      className="w-full p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--accent-green)] focus:border-transparent"
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

// Edital preview component - Improved design
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
    <div className="bg-gradient-to-br from-[var(--accent-green)]/5 to-[var(--accent-green)]/10 rounded-xl p-5 border border-[var(--accent-green)]/20">
      {/* Success header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-green)] flex items-center justify-center shadow-lg shadow-[var(--accent-green)]/30">
          <IconCheck size={20} className="text-white" strokeWidth={3} />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[var(--text-primary)]">
            Edital processado com sucesso!
          </p>
          <p className="text-[12px] text-[var(--text-secondary)]">
            Informações extraídas automaticamente
          </p>
        </div>
      </div>

      {/* Extracted data */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-[var(--bg-elevated)] rounded-lg p-3">
          <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Nome</p>
          <p className="text-[13px] font-semibold text-[var(--text-primary)] line-clamp-2">{data.nome}</p>
        </div>
        {data.banca && (
          <div className="bg-[var(--bg-elevated)] rounded-lg p-3 flex items-start gap-2">
            <IconBuilding size={16} className="text-[var(--accent-green)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Banca</p>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">{data.banca}</p>
            </div>
          </div>
        )}
        {data.ano && (
          <div className="bg-[var(--bg-elevated)] rounded-lg p-3 flex items-start gap-2">
            <IconCalendar size={16} className="text-[var(--accent-green)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Ano</p>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">{data.ano}</p>
            </div>
          </div>
        )}
      </div>

      {/* Cargo selection */}
      {data.cargos && data.cargos.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] pt-4">
          <div className="flex items-center gap-2 mb-3">
            <IconUsers size={16} className="text-[var(--accent-green)]" />
            <span className="text-[13px] font-medium text-[var(--text-primary)]">
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
            <p className="text-[14px] font-semibold text-[var(--accent-green)] bg-[var(--bg-elevated)] rounded-lg p-3">
              {data.cargos[0]}
            </p>
          )}
        </div>
      )}

      {/* Disciplines preview */}
      {data.disciplinas && data.disciplinas.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <p className="text-[12px] text-[var(--text-muted)] mb-2">
            {data.disciplinas.length} disciplinas identificadas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.disciplinas.slice(0, 8).map((disc, idx) => (
              <span
                key={idx}
                className="px-2 py-1 rounded-md bg-[var(--bg-muted)] text-[11px] text-[var(--text-secondary)]"
              >
                {disc}
              </span>
            ))}
            {data.disciplinas.length > 8 && (
              <span className="px-2 py-1 rounded-md bg-[var(--bg-muted)] text-[11px] text-[var(--text-muted)]">
                +{data.disciplinas.length - 8} mais
              </span>
            )}
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
      <div className="flex items-start gap-2 py-1.5 pl-4">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]/50 mt-1.5 flex-shrink-0" />
        <span className="text-[12px] text-[var(--text-secondary)]">
          {displayId}{item.texto}
        </span>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => toggleItem(itemKey)}
        className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors text-left"
      >
        <span className="text-[var(--text-muted)]">
          {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </span>
        <span className="flex-1 text-[12px] text-[var(--text-primary)]">
          {displayId}{item.texto}
        </span>
        <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-muted)] px-1.5 py-0.5 rounded">
          {item.filhos.length}
        </span>
      </button>
      {isExpanded && (
        <div className="ml-4 border-l border-[var(--border-subtle)]">
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

// Taxonomy preview component - Improved design
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
    if (disc.itens) return acc + countTotalItems(disc.itens);
    return acc + (disc.assuntos?.length || 0);
  }, 0);

  return (
    <div className="bg-gradient-to-br from-[var(--accent-amber)]/5 to-[var(--accent-amber)]/10 rounded-xl p-5 border border-[var(--accent-amber)]/20">
      {/* Success header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-amber)] flex items-center justify-center shadow-lg shadow-[var(--accent-amber)]/30">
          <IconCheck size={20} className="text-white" strokeWidth={3} />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[var(--text-primary)]">
            Conteúdo extraído!
          </p>
          <p className="text-[12px] text-[var(--text-secondary)]">
            Taxonomia estruturada pronta para uso
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-4">
        <div className="bg-[var(--bg-elevated)] rounded-lg px-4 py-3 text-center flex-1">
          <p className="text-[24px] font-bold text-[var(--accent-green)] tabular-nums">{totalDisciplinas}</p>
          <p className="text-[11px] text-[var(--text-muted)]">Disciplinas</p>
        </div>
        <div className="bg-[var(--bg-elevated)] rounded-lg px-4 py-3 text-center flex-1">
          <p className="text-[24px] font-bold text-[var(--accent-amber)] tabular-nums">{totalItens}</p>
          <p className="text-[11px] text-[var(--text-muted)]">Itens</p>
        </div>
      </div>

      {/* Taxonomy tree */}
      {disciplinas.length > 0 && (
        <div className="max-h-52 overflow-y-auto bg-[var(--bg-elevated)] rounded-lg p-2">
          {disciplinas.map((disc: DisciplinaConteudo, dIdx: number) => {
            const discKey = `d-${dIdx}`;
            const isDiscExpanded = expandedItems.has(discKey);
            const hasItens = disc.itens && disc.itens.length > 0;
            const itemCount = hasItens ? disc.itens.length : (disc.assuntos?.length || 0);

            return (
              <div key={dIdx}>
                <button
                  onClick={() => toggleItem(discKey)}
                  className="w-full flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors text-left"
                >
                  <span className="text-[var(--text-muted)]">
                    {isDiscExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-[var(--text-primary)]">
                    {disc.nome}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-muted)] px-2 py-0.5 rounded">
                    {itemCount} itens
                  </span>
                </button>

                {isDiscExpanded && hasItens && (
                  <div className="ml-4 border-l border-[var(--border-subtle)]">
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
                  <div className="ml-4 border-l border-[var(--border-subtle)]">
                    {disc.assuntos.map((assunto, aIdx) => (
                      <div key={aIdx} className="flex items-start gap-2 py-1.5 pl-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-amber)]/50 mt-1.5 flex-shrink-0" />
                        <span className="text-[12px] text-[var(--text-secondary)]">{assunto.nome}</span>
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

// Extraction results preview - Improved design
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
  const successCount = results.filter(r => r.success).length;
  const totalQuestoes = results.reduce((acc, r) => acc + (r.total_questoes || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex gap-3">
        <div className="flex-1 bg-[var(--accent-green)]/10 rounded-xl p-4 text-center border border-[var(--accent-green)]/20">
          <p className="text-[28px] font-bold text-[var(--accent-green)] tabular-nums">{successCount}</p>
          <p className="text-[11px] text-[var(--text-secondary)]">Provas processadas</p>
        </div>
        <div className="flex-1 bg-[var(--accent-blue)]/10 rounded-xl p-4 text-center border border-[var(--accent-blue)]/20">
          <p className="text-[28px] font-bold text-[var(--accent-blue)] tabular-nums">{totalQuestoes}</p>
          <p className="text-[11px] text-[var(--text-secondary)]">Questões extraídas</p>
        </div>
      </div>

      {/* Individual results */}
      <div className="max-h-40 overflow-y-auto space-y-2">
        {results.map((result, idx) => (
          <div
            key={idx}
            className={`
              flex items-center gap-3 p-3 rounded-lg border transition-all
              ${result.success
                ? 'bg-[var(--bg-subtle)] border-[var(--border-subtle)]'
                : 'bg-[var(--accent-red)]/5 border-[var(--accent-red)]/20'
              }
            `}
          >
            <div
              className={`
                w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                ${result.success ? 'bg-[var(--accent-green)]/15' : 'bg-[var(--accent-red)]/15'}
              `}
            >
              {result.success ? (
                <IconCheck size={16} className="text-[var(--accent-green)]" />
              ) : (
                <IconX size={16} className="text-[var(--accent-red)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                {result.filename}
              </p>
              {result.success ? (
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {result.total_questoes || 0} questões • {result.format || 'PDF'}
                </p>
              ) : (
                <p className="text-[11px] text-[var(--accent-red)]">
                  {result.error || 'Erro desconhecido'}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Drop zone component - Improved design
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
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={onDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300
        ${isDragging
          ? 'border-[var(--accent-green)] bg-[var(--accent-green)]/10 scale-[1.02]'
          : 'border-[var(--border-default)] hover:border-[var(--accent-green)]/50 hover:bg-[var(--bg-subtle)]'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div className="space-y-4">
        <div
          className={`
            w-16 h-16 rounded-2xl mx-auto flex items-center justify-center transition-all duration-300
            ${isDragging
              ? 'bg-[var(--accent-green)] scale-110'
              : 'bg-[var(--bg-muted)]'
            }
          `}
        >
          <Icon
            size={32}
            className={`transition-colors duration-300 ${
              isDragging ? 'text-white' : 'text-[var(--accent-green)]'
            }`}
          />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">{title}</p>
          <p className="text-[13px] text-[var(--text-secondary)]">{subtitle}</p>
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
            className={`
              inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-[13px]
              bg-[var(--accent-green)] text-white shadow-lg shadow-[var(--accent-green)]/30
              transition-all duration-200
              ${disabled
                ? 'pointer-events-none opacity-50'
                : 'cursor-pointer hover:bg-[var(--accent-green-light)] hover:shadow-xl hover:shadow-[var(--accent-green)]/40 active:scale-95'
              }
            `}
          >
            <IconUpload size={16} />
            Selecionar Arquivo{multiple ? 's' : ''}
          </span>
        </label>
      </div>
    </div>
  );
}

export function ProjetoWorkflowModal({
  isOpen,
  onClose,
  onUploadSuccess,
}: ProjetoWorkflowModalProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  const [, setEditalFile] = useState<File | null>(null);
  const [conteudoProgramaticoFile, setConteudoProgramaticoFile] = useState<File | null>(null);
  const [provasFiles, setProvasFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>('');

  // Upload status for progress component
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);

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
  const [projetoId, setProjetoId] = useState<string | null>(null);

  // Store actions
  const setActiveEdital = useAppStore((state) => state.setActiveEdital);
  const setQuestoes = useAppStore((state) => state.setQuestoes);
  const setIncidencia = useAppStore((state) => state.setIncidencia);

  // Auto-select cargo if only one - legitimate derived state update
  useEffect(() => {
    if (extractedEdital?.cargos?.length === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCargo(extractedEdital.cargos[0]);
    }
  }, [extractedEdital]);

  // Upload edital
  const uploadEdital = useCallback(async (file: File) => {
    setUploadStatus('uploading');
    setUploadMessage('Enviando arquivo...');
    setCurrentFileName(file.name);
    setUploadProgress(0);
    setError('');

    try {
      // Upload with progress tracking
      const result = await api.uploadEdital(file, (progress) => {
        setUploadProgress(progress);
        setUploadMessage(`Enviando arquivo... ${progress}%`);

        // When upload completes, switch to processing phase
        if (progress === 100) {
          setUploadStatus('processing');
          setUploadProgress(undefined);
          setUploadMessage('Extraindo informações do edital com IA...');
        }
      });

      setExtractedEdital(result);
      setUploadStatus('success');
      setUploadMessage('Edital processado com sucesso!');
      setUploadProgress(undefined);
    } catch {
      setUploadStatus('error');
      setError('Erro ao fazer upload do edital');
      setUploadMessage('');
      setUploadProgress(undefined);
    }
  }, []);

  // Upload conteúdo programático
  const uploadConteudo = useCallback(
    async (file: File) => {
      if (!extractedEdital) return;

      setUploadStatus('uploading');
      setUploadMessage('Enviando arquivo...');
      setCurrentFileName(file.name);
      setUploadProgress(0);
      setError('');

      try {
        const result = await api.uploadConteudoProgramatico(
          extractedEdital.edital_id,
          file,
          selectedCargo || undefined,
          (progress) => {
            setUploadProgress(progress);
            setUploadMessage(`Enviando arquivo... ${progress}%`);

            if (progress === 100) {
              setUploadStatus('processing');
              setUploadProgress(undefined);
              setUploadMessage('Extraindo taxonomia do conteúdo programático...');
            }
          }
        );

        setExtractedTaxonomy(result);
        setUploadStatus('success');
        setUploadMessage('Conteúdo extraído com sucesso!');
        setUploadProgress(undefined);
      } catch {
        setUploadStatus('error');
        setError('Erro ao fazer upload do conteúdo programático');
        setUploadMessage('');
        setUploadProgress(undefined);
      }
    },
    [extractedEdital, selectedCargo]
  );

  // Upload provas - uses projetoId to ensure all provas go to the same project
  const uploadProvas = useCallback(
    async (files: File[]) => {
      if (!projetoId || files.length === 0) return;

      setUploadStatus('uploading');
      setUploadMessage(`Enviando ${files.length} arquivo(s)...`);
      setCurrentFileName(files.map(f => f.name).join(', '));
      setUploadProgress(0);
      setError('');

      try {
        const result = await api.uploadProvasProjeto(
          projetoId,
          files,
          (progress) => {
            setUploadProgress(progress);
            setUploadMessage(`Enviando ${files.length} arquivo(s)... ${progress}%`);

            if (progress === 100) {
              setUploadStatus('processing');
              setUploadProgress(undefined);
              setUploadMessage(`Extraindo questões de ${files.length} prova(s)... Isso pode demorar alguns minutos.`);
            }
          }
        );

        setExtractionResults(result.results);
        setUploadStatus('success');
        setUploadMessage('Extração concluída!');
        setUploadProgress(undefined);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro ao fazer upload das provas';
        setUploadStatus('error');
        setError(message);
        setUploadMessage('');
        setUploadProgress(undefined);
      }
    },
    [projetoId]
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

  const handleNext = async () => {
    if (currentStep === 1 && extractedEdital) {
      if (extractedEdital.cargos?.length > 1 && !selectedCargo) {
        setError('Por favor, selecione um cargo antes de continuar');
        return;
      }

      // Create the project now so that provas uploads go to this project
      setUploadStatus('processing');
      setUploadMessage('Criando projeto...');

      try {
        const projeto = await api.createProjeto({
          nome: extractedEdital.nome,
          banca: extractedEdital.banca,
          cargo: selectedCargo || (extractedEdital.cargos?.length === 1 ? extractedEdital.cargos[0] : undefined),
          ano: extractedEdital.ano,
        });

        // Link the edital to the project
        await api.vincularEdital(projeto.id, extractedEdital.edital_id);

        setProjetoId(projeto.id);
        setCurrentStep(2);
        setUploadStatus('idle');
        setUploadMessage('');
      } catch (err) {
        console.error('Erro ao criar projeto:', err);
        setUploadStatus('error');
        setError('Erro ao criar projeto. Por favor, tente novamente.');
        setUploadMessage('');
      }
    } else if (currentStep === 2) {
      setCurrentStep(3);
      setUploadStatus('idle');
      setUploadMessage('');
    }
  };

  const handleFinish = async () => {
    if (!extractedEdital || !extractionResults || !projetoId) return;

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

    // Project was already created in handleNext (step 1 -> step 2 transition)
    // No need to create another project here

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
      setUploadStatus('idle');
      setUploadMessage('');
    }
  };

  const handleClose = () => {
    if (uploadStatus !== 'uploading' && uploadStatus !== 'processing') {
      setCurrentStep(1);
      setEditalFile(null);
      setConteudoProgramaticoFile(null);
      setProvasFiles([]);
      setExtractedEdital(null);
      setExtractedTaxonomy(null);
      setExtractionResults(null);
      setSelectedCargo(null);
      setProjetoId(null);
      setUploadStatus('idle');
      setUploadMessage('');
      setCurrentFileName('');
      setError('');
      onClose();
    }
  };

  const isUploading = uploadStatus === 'uploading' || uploadStatus === 'processing';

  const canProceed = () => {
    if (isUploading) return false;
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Criar Novo Projeto" size="lg">
      <div className="space-y-6">
        {/* Step indicators - Improved design */}
        <div className="flex items-center justify-between px-2 py-3 bg-[var(--bg-subtle)] rounded-xl">
          <StepIndicator step={1} currentStep={currentStep} label="Edital" />
          <div className="flex-1 h-0.5 bg-[var(--border-subtle)] mx-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent-green)] transition-all duration-500 ease-out"
              style={{ width: currentStep > 1 ? '100%' : '0%' }}
            />
          </div>
          <StepIndicator step={2} currentStep={currentStep} label="Conteúdo" />
          <div className="flex-1 h-0.5 bg-[var(--border-subtle)] mx-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent-green)] transition-all duration-500 ease-out"
              style={{ width: currentStep > 2 ? '100%' : '0%' }}
            />
          </div>
          <StepIndicator step={3} currentStep={currentStep} label="Provas" />
        </div>

        {/* Steps Content with Animations */}
        <AnimatePresence mode="wait">
          {/* Step 1: Upload Edital */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="space-y-4"
            >
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">
                  Upload do Edital
                </h3>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Faça upload do PDF do edital. A IA extrairá automaticamente as informações.
                </p>
              </div>

              {!extractedEdital && uploadStatus === 'idle' && (
                <DropZone
                  onDrop={(e) => handleDrop(e, 1)}
                  onFileSelect={(e) => handleFileSelect(e, 1)}
                  isDragging={isDragging}
                  setIsDragging={setIsDragging}
                  icon={IconFileText}
                  title="Arraste o PDF do edital aqui"
                  subtitle="ou clique para selecionar o arquivo"
                  inputId="edital-input"
                  disabled={isUploading}
                />
              )}

              {(uploadStatus === 'uploading' || uploadStatus === 'processing') && !extractedEdital && (
                <UploadProgress
                  status={uploadStatus}
                  progress={uploadProgress}
                  fileName={currentFileName}
                  message={uploadMessage}
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
              key="step-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="space-y-4"
            >
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">
                  Conteúdo Programático
                  <span className="text-[var(--text-muted)] font-normal text-[13px] ml-2">(Opcional)</span>
                </h3>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Faça upload do PDF com o conteúdo programático para classificação automática.
                  {selectedCargo && (
                    <span className="text-[var(--accent-green)] font-medium"> Cargo: {selectedCargo}</span>
                  )}
                </p>
              </div>

              {!extractedTaxonomy && uploadStatus === 'idle' && (
                <DropZone
                  onDrop={(e) => handleDrop(e, 2)}
                  onFileSelect={(e) => handleFileSelect(e, 2)}
                  isDragging={isDragging}
                  setIsDragging={setIsDragging}
                  icon={IconBookOpen}
                  title="Arraste o conteúdo programático aqui"
                  subtitle="ou clique para selecionar (opcional)"
                  inputId="conteudo-input"
                  disabled={isUploading}
                />
              )}

              {(uploadStatus === 'uploading' || uploadStatus === 'processing') && !extractedTaxonomy && (
                <UploadProgress
                  status={uploadStatus}
                  progress={uploadProgress}
                  fileName={currentFileName}
                  message={uploadMessage}
                />
              )}

              {extractedTaxonomy && <TaxonomyPreview data={extractedTaxonomy} />}
            </motion.div>
          )}

          {/* Step 3: Upload Provas */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="space-y-4"
            >
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">
                  Upload das Provas
                </h3>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Faça upload dos PDFs das provas. A IA extrairá as questões automaticamente.
                </p>
              </div>

              {!extractionResults && uploadStatus === 'idle' && (
                <DropZone
                  onDrop={(e) => handleDrop(e, 3)}
                  onFileSelect={(e) => handleFileSelect(e, 3)}
                  isDragging={isDragging}
                  setIsDragging={setIsDragging}
                  icon={IconFolder}
                  title="Arraste os PDFs das provas aqui"
                  subtitle="Você pode selecionar múltiplos arquivos"
                  inputId="provas-input"
                  multiple
                  disabled={isUploading}
                />
              )}

              {(uploadStatus === 'uploading' || uploadStatus === 'processing') && !extractionResults && (
                <UploadProgress
                  status={uploadStatus}
                  progress={uploadProgress}
                  fileName={currentFileName}
                  message={uploadMessage}
                />
              )}

              {extractionResults && <ExtractionResultsPreview results={extractionResults} />}

              {extractionResults && (
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      setExtractionResults(null);
                      setProvasFiles([]);
                      setUploadStatus('idle');
                    }}
                    className="text-[13px] text-[var(--accent-green)] hover:underline"
                  >
                    Selecionar outros arquivos
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="p-4 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/20 rounded-xl flex items-center gap-3">
            <IconAlertTriangle size={20} className="text-[var(--accent-red)] flex-shrink-0" />
            <p className="text-[13px] text-[var(--accent-red)]">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-4 border-t border-[var(--border-subtle)]">
          <div>
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                disabled={isUploading}
                className="px-4 py-2.5 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isUploading}
              className="px-4 py-2.5 rounded-lg text-[13px] font-medium bg-[var(--bg-muted)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              onClick={currentStep === 3 ? handleFinish : handleNext}
              disabled={!canProceed()}
              className={`
                px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-200
                ${canProceed()
                  ? 'bg-[var(--accent-green)] text-white shadow-lg shadow-[var(--accent-green)]/30 hover:bg-[var(--accent-green-hover)] hover:scale-105'
                  : 'bg-[var(--bg-muted)] text-[var(--text-muted)] cursor-not-allowed'
                }
              `}
            >
              {currentStep === 3
                ? 'Finalizar'
                : currentStep === 2 && !conteudoProgramaticoFile
                ? 'Pular'
                : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
