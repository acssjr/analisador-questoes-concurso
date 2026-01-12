import { useState, useCallback, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button, Badge } from '../ui';
import { api } from '../../services/api';
import { useAppStore } from '../../store/appStore';
import type { Edital, Questao, IncidenciaNode, EditalUploadResponse, ConteudoProgramaticoUploadResponse, DisciplinaConteudo } from '../../types';

interface EditalWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

type WorkflowStep = 1 | 2 | 3;

// Função auxiliar para construir árvore de incidência a partir das questões
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
      questoes: questoesDisciplina
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
        questoes: questoesAssunto
      });
    }

    disciplinaNode.children!.sort((a, b) => b.count - a.count);
    tree.push(disciplinaNode);
  }

  tree.sort((a, b) => b.count - a.count);
  return tree;
}

// Componente para mostrar preview do edital extraído
function EditalPreview({ data, selectedCargo, onCargoSelect }: {
  data: EditalUploadResponse;
  selectedCargo: string | null;
  onCargoSelect: (cargo: string) => void;
}) {
  const hasMutipleCargos = data.cargos && data.cargos.length > 1;

  return (
    <div className="surface p-4 space-y-3 border border-semantic-success rounded-lg">
      <div className="flex items-center gap-2 text-semantic-success">
        <span className="text-xl">✓</span>
        <span className="font-medium">Informações extraídas do edital</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-text-secondary">Nome:</span>
          <p className="text-text-primary font-medium">{data.nome}</p>
        </div>
        {data.banca && (
          <div>
            <span className="text-text-secondary">Banca:</span>
            <p className="text-text-primary font-medium">{data.banca}</p>
          </div>
        )}
        {data.ano && (
          <div>
            <span className="text-text-secondary">Ano:</span>
            <p className="text-text-primary font-medium">{data.ano}</p>
          </div>
        )}
      </div>

      {/* Seleção de Cargo */}
      {data.cargos && data.cargos.length > 0 && (
        <div className="space-y-2">
          <span className="text-text-secondary text-sm">
            {hasMutipleCargos ? 'Selecione seu cargo:' : 'Cargo:'}
          </span>
          {hasMutipleCargos ? (
            <select
              value={selectedCargo || ''}
              onChange={(e) => onCargoSelect(e.target.value)}
              className="w-full p-2 rounded bg-dark-surface border border-dark-border text-text-primary text-sm focus:border-disciplinas-portugues focus:outline-none"
            >
              <option value="">-- Selecione um cargo --</option>
              {data.cargos.map((cargo, idx) => (
                <option key={idx} value={cargo}>
                  {cargo}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-text-primary font-medium">{data.cargos[0]}</p>
          )}
        </div>
      )}

      {data.disciplinas && data.disciplinas.length > 0 && (
        <div>
          <span className="text-text-secondary text-sm">Disciplinas identificadas:</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.disciplinas.map((disc, idx) => (
              <Badge key={idx} variant="info" className="text-xs">
                {disc}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para mostrar preview da taxonomia extraída com hierarquia inteligente
function TaxonomyPreview({ data }: { data: ConteudoProgramaticoUploadResponse }) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Helper para singular/plural correto
  const pluralize = (count: number, singular: string, plural: string) => {
    return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
  };

  // Verifica se um nome é "útil" (não vazio, não só números, não igual ao pai)
  const isUsefulName = (nome: string, parentNome?: string): boolean => {
    if (!nome || nome.trim() === '') return false;
    if (/^\d+\.?\s*$/.test(nome.trim())) return false; // Só números como "1." ou "2"
    if (parentNome && nome.toLowerCase().trim() === parentNome.toLowerCase().trim()) return false;
    return true;
  };

  // Conta total de itens folha em um assunto (para mostrar contagem real)
  const countLeafItems = (assunto: { topicos?: Array<{ nome: string; subtopicos?: string[] }> }): number => {
    if (!assunto.topicos) return 0;
    let total = 0;
    for (const topico of assunto.topicos) {
      if (topico.subtopicos && topico.subtopicos.length > 0) {
        total += topico.subtopicos.length;
      } else {
        total += 1; // O próprio tópico é um item folha
      }
    }
    return total;
  };

  // Obtém todos os itens folha de um assunto (achatando a hierarquia quando necessário)
  const getLeafItems = (assunto: { nome: string; topicos?: Array<{ nome: string; subtopicos?: string[] }> }): string[] => {
    const items: string[] = [];
    if (!assunto.topicos) return items;

    for (const topico of assunto.topicos) {
      if (topico.subtopicos && topico.subtopicos.length > 0) {
        // Se o tópico tem nome útil, prefixar os subtópicos
        if (isUsefulName(topico.nome, assunto.nome)) {
          items.push(...topico.subtopicos.map(s => `${topico.nome}: ${s}`));
        } else {
          items.push(...topico.subtopicos);
        }
      } else if (isUsefulName(topico.nome, assunto.nome)) {
        items.push(topico.nome);
      }
    }
    return items;
  };

  // Verifica se deve mostrar hierarquia intermediária ou achatar direto
  const shouldFlatten = (assunto: { nome: string; topicos?: Array<{ nome: string; subtopicos?: string[] }> }): boolean => {
    if (!assunto.topicos || assunto.topicos.length === 0) return true;
    // Achatar se todos os tópicos têm nome inútil
    const hasUsefulTopicName = assunto.topicos.some(t => isUsefulName(t.nome, assunto.nome));
    // Ou se tem só 1 tópico com nome igual ao assunto
    if (assunto.topicos.length === 1 && !isUsefulName(assunto.topicos[0].nome, assunto.nome)) {
      return true;
    }
    return !hasUsefulTopicName;
  };

  const disciplinas = data.taxonomia?.disciplinas || [];

  return (
    <div className="surface p-4 space-y-3 border border-semantic-success rounded-lg">
      <div className="flex items-center gap-2 text-semantic-success">
        <span className="text-xl">✓</span>
        <span className="font-medium">Conteúdo Programático extraído</span>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="text-center">
          <p className="text-2xl font-bold text-disciplinas-portugues">{data.total_disciplinas}</p>
          <p className="text-text-secondary">Disciplinas</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-disciplinas-matematica">{data.total_assuntos}</p>
          <p className="text-text-secondary">Assuntos</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-disciplinas-constitucional">{data.total_topicos}</p>
          <p className="text-text-secondary">Tópicos</p>
        </div>
      </div>

      {disciplinas.length > 0 && (
        <div className="max-h-72 overflow-y-auto space-y-1">
          {disciplinas.map((disc: DisciplinaConteudo, dIdx: number) => {
            const discKey = `d-${dIdx}`;
            const isDiscExpanded = expandedItems.has(discKey);

            return (
              <div key={dIdx} className="text-sm">
                {/* Nível 1: Disciplina */}
                <button
                  onClick={() => toggleItem(discKey)}
                  className="flex items-center gap-2 w-full text-left hover:bg-dark-border/20 p-1 rounded"
                >
                  <span className="text-text-secondary">
                    {isDiscExpanded ? '▼' : '▶'}
                  </span>
                  <span className="text-text-primary font-medium">{disc.nome}</span>
                  <span className="text-text-secondary text-xs">
                    ({pluralize(disc.assuntos?.length || 0, 'assunto', 'assuntos')})
                  </span>
                </button>

                {isDiscExpanded && disc.assuntos && (
                  <div className="ml-4 pl-2 border-l border-dark-border space-y-1">
                    {disc.assuntos.map((assunto, aIdx) => {
                      const assuntoKey = `${discKey}-a-${aIdx}`;
                      const isAssuntoExpanded = expandedItems.has(assuntoKey);
                      const leafCount = countLeafItems(assunto);
                      const flatten = shouldFlatten(assunto);
                      const hasContent = leafCount > 0 || (assunto.topicos && assunto.topicos.length > 0);

                      if (!hasContent) {
                        // Assunto sem conteúdo - mostrar só o nome
                        return (
                          <div key={aIdx} className="text-text-secondary text-xs p-1">
                            • {assunto.nome}
                          </div>
                        );
                      }

                      return (
                        <div key={aIdx}>
                          {/* Nível 2: Assunto */}
                          <button
                            onClick={() => toggleItem(assuntoKey)}
                            className="flex items-center gap-2 w-full text-left hover:bg-dark-border/20 p-1 rounded text-xs"
                          >
                            <span className="text-text-secondary">
                              {isAssuntoExpanded ? '▼' : '▶'}
                            </span>
                            <span className="text-text-secondary">{assunto.nome}</span>
                            <span className="text-text-secondary/60">
                              ({pluralize(leafCount, 'item', 'itens')})
                            </span>
                          </button>

                          {/* Conteúdo expandido */}
                          {isAssuntoExpanded && (
                            <div className="ml-4 pl-2 border-l border-dark-border/50 space-y-0.5">
                              {flatten ? (
                                // Modo achatado: mostrar todos os itens folha diretamente
                                getLeafItems(assunto).map((item, iIdx) => (
                                  <div key={iIdx} className="text-text-secondary/70 text-xs p-0.5">
                                    – {item}
                                  </div>
                                ))
                              ) : (
                                // Modo hierárquico: mostrar tópicos com expansão
                                assunto.topicos!.map((topico, tIdx) => {
                                  const topicoKey = `${assuntoKey}-t-${tIdx}`;
                                  const isTopicoExpanded = expandedItems.has(topicoKey);
                                  const hasSubtopicos = topico.subtopicos && topico.subtopicos.length > 0;
                                  const topicoLeafCount = hasSubtopicos ? topico.subtopicos!.length : 0;

                                  if (!hasSubtopicos) {
                                    // Tópico sem subtópicos - mostrar só o nome
                                    return (
                                      <div key={tIdx} className="text-text-secondary/70 text-xs p-0.5">
                                        ◦ {topico.nome}
                                      </div>
                                    );
                                  }

                                  return (
                                    <div key={tIdx}>
                                      <button
                                        onClick={() => toggleItem(topicoKey)}
                                        className="flex items-center gap-2 w-full text-left hover:bg-dark-border/20 p-0.5 rounded text-xs"
                                      >
                                        <span className="text-text-secondary/60">
                                          {isTopicoExpanded ? '▼' : '▶'}
                                        </span>
                                        <span className="text-text-secondary/70">
                                          {isUsefulName(topico.nome, assunto.nome) ? topico.nome : `Grupo ${tIdx + 1}`}
                                        </span>
                                        <span className="text-text-secondary/50">
                                          ({pluralize(topicoLeafCount, 'item', 'itens')})
                                        </span>
                                      </button>

                                      {isTopicoExpanded && (
                                        <div className="ml-4 pl-2 border-l border-dark-border/30 space-y-0.5">
                                          {topico.subtopicos!.map((subtopico, sIdx) => (
                                            <div key={sIdx} className="text-text-secondary/60 text-xs p-0.5">
                                              – {subtopico}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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

// Componente para mostrar resultado da extração de provas
function ExtractionResultsPreview({ results }: { results: Array<{
  success: boolean;
  filename: string;
  format?: string;
  total_questoes?: number;
  error?: string;
}> }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-primary">Resultados da extração:</p>
      <div className="max-h-48 overflow-y-auto space-y-2">
        {results.map((result, idx) => (
          <div
            key={idx}
            className={`surface p-3 flex items-center justify-between border rounded ${
              result.success ? 'border-semantic-success' : 'border-semantic-error'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`text-xl ${result.success ? 'text-semantic-success' : 'text-semantic-error'}`}>
                {result.success ? '✓' : '✗'}
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary">{result.filename}</p>
                {result.success ? (
                  <p className="text-xs text-text-secondary">
                    Formato: {result.format} • {result.total_questoes || 0} questões extraídas
                  </p>
                ) : (
                  <p className="text-xs text-semantic-error">
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

export function EditalWorkflowModal({ isOpen, onClose, onUploadSuccess }: EditalWorkflowModalProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  const [_editalFile, setEditalFile] = useState<File | null>(null);
  const [conteudoProgramaticoFile, setConteudoProgramaticoFile] = useState<File | null>(null);
  const [provasFiles, setProvasFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Estados para dados extraídos
  const [extractedEdital, setExtractedEdital] = useState<EditalUploadResponse | null>(null);
  const [extractedTaxonomy, setExtractedTaxonomy] = useState<ConteudoProgramaticoUploadResponse | null>(null);
  const [extractionResults, setExtractionResults] = useState<Array<{
    success: boolean;
    filename: string;
    format?: string;
    total_questoes?: number;
    questoes?: any[];
    metadados?: any;
    error?: string;
  }> | null>(null);

  // Estado para cargo selecionado
  const [selectedCargo, setSelectedCargo] = useState<string | null>(null);

  // Store actions
  const setActiveEdital = useAppStore(state => state.setActiveEdital);
  const setQuestoes = useAppStore(state => state.setQuestoes);
  const setIncidencia = useAppStore(state => state.setIncidencia);

  // Auto-select cargo if only one
  useEffect(() => {
    if (extractedEdital?.cargos?.length === 1) {
      setSelectedCargo(extractedEdital.cargos[0]);
    }
  }, [extractedEdital]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Upload do edital (Step 1) - chamado automaticamente
  const uploadEdital = useCallback(async (file: File) => {
    setIsUploading(true);
    setProgress('Extraindo informações do edital...');
    setError('');

    try {
      const result = await api.uploadEdital(file);
      setExtractedEdital(result);
      setProgress('');
    } catch (err) {
      setError('Erro ao fazer upload do edital');
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Upload do conteúdo programático (Step 2) - chamado automaticamente
  const uploadConteudo = useCallback(async (file: File) => {
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
    } catch (err) {
      setError('Erro ao fazer upload do conteúdo programático');
    } finally {
      setIsUploading(false);
    }
  }, [extractedEdital, selectedCargo]);

  // Upload das provas (Step 3) - chamado automaticamente
  const uploadProvas = useCallback(async (files: File[]) => {
    if (!extractedEdital || files.length === 0) return;

    setIsUploading(true);
    setProgress(`Extraindo questões de ${files.length} prova(s)...`);
    setError('');

    try {
      const result = await api.uploadProvasVinculadas(extractedEdital.edital_id, files);
      setExtractionResults(result.results);
      setProgress('');
    } catch (err: any) {
      setError(err?.message || 'Erro ao fazer upload das provas');
    } finally {
      setIsUploading(false);
    }
  }, [extractedEdital]);

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
      setExtractedEdital(null);
      setSelectedCargo(null);
      // Auto-extract
      uploadEdital(pdfFiles[0]);
    } else if (step === 2 && pdfFiles.length > 0) {
      setConteudoProgramaticoFile(pdfFiles[0]);
      setExtractedTaxonomy(null);
      // Auto-extract
      uploadConteudo(pdfFiles[0]);
    } else if (step === 3) {
      const newFiles = [...provasFiles, ...pdfFiles];
      setProvasFiles(newFiles);
      setExtractionResults(null);
      // Auto-extract
      uploadProvas(newFiles);
    }
  }, [provasFiles, uploadEdital, uploadConteudo, uploadProvas]);

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
      setExtractedEdital(null);
      setSelectedCargo(null);
      // Auto-extract
      uploadEdital(pdfFiles[0]);
    } else if (step === 2 && pdfFiles.length > 0) {
      setConteudoProgramaticoFile(pdfFiles[0]);
      setExtractedTaxonomy(null);
      // Auto-extract
      uploadConteudo(pdfFiles[0]);
    } else if (step === 3) {
      const newFiles = [...provasFiles, ...pdfFiles];
      setProvasFiles(newFiles);
      setExtractionResults(null);
      // Auto-extract
      uploadProvas(newFiles);
    }

    // Reset input
    e.target.value = '';
  }, [provasFiles, uploadEdital, uploadConteudo, uploadProvas]);

  // Avançar para próximo passo
  const handleNext = () => {
    if (currentStep === 1 && extractedEdital) {
      // Verificar se cargo foi selecionado quando há múltiplos
      if (extractedEdital.cargos?.length > 1 && !selectedCargo) {
        setError('Por favor, selecione um cargo antes de continuar');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  // Finalizar workflow
  const handleFinish = () => {
    if (!extractedEdital || !extractionResults) return;

    const questoesExtraidas: Questao[] = (extractionResults || [])
      .filter((r) => r.success && r.questoes)
      .flatMap((r) => r.questoes!.map((q: any, idx: number) => ({
        id: q.id || `${r.filename}-${idx}`,
        numero: q.numero || idx + 1,
        ano: q.ano || r.metadados?.ano || new Date().getFullYear(),
        banca: q.banca || r.metadados?.banca || extractedEdital.banca || 'Desconhecida',
        cargo: q.cargo || r.metadados?.cargo || selectedCargo || '',
        disciplina: q.disciplina || 'Não classificada',
        assunto_pci: q.assunto_pci || q.assunto || '',
        enunciado: q.enunciado || '',
        alternativas: q.alternativas || {},
        gabarito: q.gabarito || '',
        anulada: q.anulada || false,
        motivo_anulacao: q.motivo_anulacao,
        classificacao: q.classificacao,
      })));

    const totalQuestoes = extractionResults.reduce((acc, r) => acc + (r.total_questoes || 0), 0);

    const editalAtivo: Edital = {
      id: extractedEdital.edital_id,
      nome: extractedEdital.nome,
      arquivo_url: '',
      data_upload: new Date().toISOString(),
      total_provas: extractionResults.filter(r => r.success).length,
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
    if (currentStep === 3) return extractionResults !== null && extractionResults.some(r => r.success);
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
                Faça upload do PDF do edital. A extração inicia automaticamente.
              </p>
            </div>

            {!extractedEdital && !isUploading && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 1)}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center transition-all
                  ${isDragging
                    ? 'border-disciplinas-portugues bg-disciplinas-portugues bg-opacity-5'
                    : 'border-dark-border hover:border-disciplinas-portugues hover:bg-disciplinas-portugues hover:bg-opacity-5'
                  }
                `}
              >
                <div className="space-y-4">
                  <div className="text-5xl">📋</div>
                  <div>
                    <p className="text-text-primary font-medium mb-2">
                      Arraste o PDF do edital aqui ou clique para selecionar
                    </p>
                    <p className="text-sm text-text-secondary">
                      A extração inicia automaticamente após selecionar o arquivo
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
                    <span className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 bg-dark-surface border border-dark-border hover:bg-opacity-80 text-text-primary px-4 py-2 text-sm cursor-pointer">
                      Selecionar Edital
                    </span>
                  </label>
                </div>
              </div>
            )}

            {extractedEdital && (
              <EditalPreview
                data={extractedEdital}
                selectedCargo={selectedCargo}
                onCargoSelect={setSelectedCargo}
              />
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
                Faça upload do PDF com o conteúdo programático.
                {selectedCargo && <span className="text-disciplinas-portugues"> Cargo selecionado: {selectedCargo}</span>}
              </p>
            </div>

            {!extractedTaxonomy && !isUploading && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 2)}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center transition-all
                  ${isDragging
                    ? 'border-disciplinas-portugues bg-disciplinas-portugues bg-opacity-5'
                    : 'border-dark-border hover:border-disciplinas-portugues hover:bg-disciplinas-portugues hover:bg-opacity-5'
                  }
                `}
              >
                <div className="space-y-4">
                  <div className="text-5xl">📚</div>
                  <div>
                    <p className="text-text-primary font-medium mb-2">
                      Arraste o conteúdo programático aqui ou clique para selecionar
                    </p>
                    <p className="text-sm text-text-secondary">
                      A extração inicia automaticamente (opcional)
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
                    <span className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 bg-dark-surface border border-dark-border hover:bg-opacity-80 text-text-primary px-4 py-2 text-sm cursor-pointer">
                      Selecionar Arquivo
                    </span>
                  </label>
                </div>
              </div>
            )}

            {extractedTaxonomy && <TaxonomyPreview data={extractedTaxonomy} />}
          </div>
        )}

        {/* Step 3: Upload Provas */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-text-primary mb-2">Upload das Provas</h3>
              <p className="text-sm text-text-secondary">
                Faça upload dos PDFs das provas. A extração inicia automaticamente.
              </p>
            </div>

            {!extractionResults && !isUploading && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 3)}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center transition-all
                  ${isDragging
                    ? 'border-disciplinas-portugues bg-disciplinas-portugues bg-opacity-5'
                    : 'border-dark-border hover:border-disciplinas-portugues hover:bg-disciplinas-portugues hover:bg-opacity-5'
                  }
                `}
              >
                <div className="space-y-4">
                  <div className="text-5xl">📄</div>
                  <div>
                    <p className="text-text-primary font-medium mb-2">
                      Arraste os PDFs das provas aqui ou clique para selecionar
                    </p>
                    <p className="text-sm text-text-secondary">
                      Formatos suportados: PDFs do PCI Concursos
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
                    <span className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 bg-dark-surface border border-dark-border hover:bg-opacity-80 text-text-primary px-4 py-2 text-sm cursor-pointer">
                      Selecionar Provas
                    </span>
                  </label>
                </div>
              </div>
            )}

            {extractionResults && <ExtractionResultsPreview results={extractionResults} />}

            {extractionResults && (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setExtractionResults(null);
                    setProvasFiles([]);
                  }}
                >
                  Selecionar outros arquivos
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {progress && (
          <div className="p-4 bg-semantic-info bg-opacity-10 border border-semantic-info rounded flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-semantic-info border-t-transparent rounded-full"></div>
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
              onClick={currentStep === 3 ? handleFinish : handleNext}
              disabled={!canProceed() || isUploading}
            >
              {currentStep === 3
                ? 'Finalizar'
                : currentStep === 2 && !conteudoProgramaticoFile
                ? 'Pular'
                : 'Próximo'}
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-xs text-text-secondary space-y-2 pt-4 border-t border-dark-border">
          <p className="font-medium">Fluxo de trabalho:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Passo 1:</strong> Upload do edital → Selecione seu cargo (se houver vários) → Próximo</li>
            <li><strong>Passo 2:</strong> Upload do conteúdo programático (opcional) → Próximo</li>
            <li><strong>Passo 3:</strong> Upload das provas → Finalizar</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
