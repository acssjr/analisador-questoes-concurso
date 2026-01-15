import { useState, useCallback } from 'react';
import { cn } from '../../utils/cn';
import {
  IconChevronDown,
  IconChevronUp,
  IconCheck,
  IconX,
  IconAlertTriangle,
} from '../ui/Icons';

export interface ClassificacaoItem {
  disciplina: string;
  assunto: string | null;
  topico: string | null;
  subtopico: string | null;
  item_edital_path: string | null;
  confianca_disciplina: number | null;
  confianca_assunto: number | null;
  confianca_topico: number | null;
}

export interface QuestaoItem {
  id: string;
  numero: number;
  disciplina: string | null;
  assunto_pci: string | null;
  enunciado: string;
  alternativas: Record<string, string>;
  gabarito: string | null;
  anulada: boolean;
  motivo_anulacao: string | null;
  confianca_score: number | null;
  status_extracao: string | null;
  prova_nome: string | null;
  prova_ano: number | null;
  classificacao?: ClassificacaoItem | null;
}

export interface QuestionPanelProps {
  questoes: QuestaoItem[];
  selectedDisciplina: string | null;
  isLoading?: boolean;
  total: number;
  className?: string;
}

interface QuestionCardProps {
  questao: QuestaoItem;
  isExpanded: boolean;
  onToggle: () => void;
}

// Color schemes for classification tags by level
const tagColors = {
  disciplina: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  assunto: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  topico: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  subtopico: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

interface ClassificationTagProps {
  label: string;
  level: keyof typeof tagColors;
  title?: string;
}

function ClassificationTag({ label, level, title }: ClassificationTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs rounded border',
        tagColors[level]
      )}
      title={title}
    >
      {label}
    </span>
  );
}

interface ClassificationTagsProps {
  classificacao: ClassificacaoItem | null | undefined;
  compact?: boolean;
}

function ClassificationTags({ classificacao, compact = false }: ClassificationTagsProps) {
  if (!classificacao) return null;

  // Build tags array from classification hierarchy
  const tags: Array<{ label: string; level: keyof typeof tagColors; title?: string }> = [];

  if (classificacao.disciplina) {
    tags.push({
      label: classificacao.disciplina,
      level: 'disciplina',
      title: classificacao.confianca_disciplina
        ? `Confianca: ${Math.round(classificacao.confianca_disciplina * 100)}%`
        : undefined,
    });
  }

  if (classificacao.assunto) {
    tags.push({
      label: classificacao.assunto,
      level: 'assunto',
      title: classificacao.confianca_assunto
        ? `Confianca: ${Math.round(classificacao.confianca_assunto * 100)}%`
        : undefined,
    });
  }

  if (classificacao.topico) {
    tags.push({
      label: classificacao.topico,
      level: 'topico',
      title: classificacao.confianca_topico
        ? `Confianca: ${Math.round(classificacao.confianca_topico * 100)}%`
        : undefined,
    });
  }

  if (classificacao.subtopico && !compact) {
    tags.push({
      label: classificacao.subtopico,
      level: 'subtopico',
    });
  }

  if (tags.length === 0) return null;

  // In compact mode, show only first 2 tags with overflow indicator
  const displayTags = compact ? tags.slice(0, 2) : tags;
  const hasMore = compact && tags.length > 2;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {displayTags.map((tag, index) => (
        <ClassificationTag
          key={`${tag.level}-${index}`}
          label={tag.label}
          level={tag.level}
          title={tag.title}
        />
      ))}
      {hasMore && (
        <span className="text-xs text-gray-500">+{tags.length - 2}</span>
      )}
    </div>
  );
}

function QuestionCard({ questao, isExpanded, onToggle }: QuestionCardProps) {
  const alternativas = Object.entries(questao.alternativas || {}).sort(
    ([a], [b]) => a.localeCompare(b)
  );

  const getConfiancaColor = (score: number | null) => {
    if (score === null) return 'text-gray-500';
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div
      className={cn(
        'bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden transition-all',
        isExpanded && 'ring-1 ring-blue-500/50'
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/80 transition-colors"
      >
        <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-700 rounded text-sm font-medium text-gray-300">
          {questao.numero}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-300 truncate">
            {questao.enunciado.slice(0, 100)}
            {questao.enunciado.length > 100 && '...'}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            {questao.prova_nome && <span>{questao.prova_nome}</span>}
            {questao.prova_ano && <span>({questao.prova_ano})</span>}
          </div>
          {/* Compact classification tags in header */}
          {questao.classificacao && (
            <div className="mt-1.5">
              <ClassificationTags classificacao={questao.classificacao} compact />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {questao.anulada && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
              Anulada
            </span>
          )}
          {questao.gabarito && (
            <span className="w-6 h-6 flex items-center justify-center bg-green-500/20 text-green-400 text-xs font-medium rounded">
              {questao.gabarito}
            </span>
          )}
          <span className="text-gray-500">
            {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700">
          {/* Full question text */}
          <div className="mt-4">
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{questao.enunciado}</p>
          </div>

          {/* Alternatives */}
          {alternativas.length > 0 && (
            <div className="mt-4 space-y-2">
              {alternativas.map(([letra, texto]) => {
                const isCorrect = questao.gabarito === letra;
                return (
                  <div
                    key={letra}
                    className={cn(
                      'flex items-start gap-2 p-2 rounded text-sm',
                      isCorrect ? 'bg-green-500/10 border border-green-500/30' : 'bg-gray-700/30'
                    )}
                  >
                    <span
                      className={cn(
                        'flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs font-medium',
                        isCorrect ? 'bg-green-500/30 text-green-300' : 'bg-gray-600 text-gray-400'
                      )}
                    >
                      {letra}
                    </span>
                    <span className={cn('flex-1', isCorrect ? 'text-green-300' : 'text-gray-400')}>
                      {texto}
                    </span>
                    {isCorrect && (
                      <IconCheck size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Classification tags (full view) */}
          {questao.classificacao && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 font-medium">Classificacao:</span>
              </div>
              <ClassificationTags classificacao={questao.classificacao} />
              {questao.classificacao.item_edital_path && (
                <div className="mt-2 text-xs text-gray-500">
                  <span className="font-medium">Caminho edital:</span>{' '}
                  <span className="text-gray-400">{questao.classificacao.item_edital_path}</span>
                </div>
              )}
            </div>
          )}

          {/* Metadata footer */}
          <div className="mt-4 pt-3 border-t border-gray-700 flex items-center gap-4 text-xs">
            {questao.confianca_score !== null && (
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Confianca:</span>
                <span className={getConfiancaColor(questao.confianca_score)}>
                  {questao.confianca_score}%
                </span>
              </div>
            )}
            {questao.assunto_pci && !questao.classificacao && (
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Assunto:</span>
                <span className="text-gray-400">{questao.assunto_pci}</span>
              </div>
            )}
            {questao.status_extracao === 'revisar_manual' && (
              <div className="flex items-center gap-1 text-yellow-400">
                <IconAlertTriangle size={12} />
                <span>Revisar</span>
              </div>
            )}
          </div>

          {/* Anulada reason */}
          {questao.anulada && questao.motivo_anulacao && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs">
              <div className="flex items-center gap-1 text-red-400 mb-1">
                <IconX size={12} />
                <span className="font-medium">Motivo da anulacao:</span>
              </div>
              <p className="text-red-300">{questao.motivo_anulacao}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function QuestionPanel({
  questoes,
  selectedDisciplina,
  isLoading,
  total,
  className,
}: QuestionPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className={cn('bg-gray-900 border border-gray-800 rounded-lg p-8', className)}>
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Carregando questoes...</span>
        </div>
      </div>
    );
  }

  if (!selectedDisciplina) {
    return (
      <div className={cn('bg-gray-900 border border-gray-800 rounded-lg p-8 text-center', className)}>
        <p className="text-gray-500 text-sm">Selecione uma disciplina para ver as questoes</p>
      </div>
    );
  }

  if (questoes.length === 0) {
    return (
      <div className={cn('bg-gray-900 border border-gray-800 rounded-lg p-8 text-center', className)}>
        <p className="text-gray-500 text-sm">Nenhuma questao encontrada para esta disciplina</p>
      </div>
    );
  }

  return (
    <div className={cn('bg-gray-900 border border-gray-800 rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">{selectedDisciplina}</h3>
          <span className="text-xs text-gray-500">
            {questoes.length} de {total} questoes
          </span>
        </div>
      </div>

      {/* Question list */}
      <div className="max-h-[600px] overflow-y-auto scrollbar-custom p-4 space-y-3">
        {questoes.map((questao) => (
          <QuestionCard
            key={questao.id}
            questao={questao}
            isExpanded={expandedIds.has(questao.id)}
            onToggle={() => handleToggle(questao.id)}
          />
        ))}
      </div>
    </div>
  );
}
