// frontend/src/pages/projeto/AnaliseProfunda.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router';
import { api } from '../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PulsingProgressBar } from '../../components/ui/ProgressBar';
import { getDisciplinaColor } from '../../utils/colors';
import { cn } from '../../utils/cn';
import type {
  AnaliseStatus,
  AnaliseResumo,
  AnaliseResultado,
  AnaliseResultadoDisciplina,
  PatternFinding,
  VerificationResult,
} from '../../types';

interface ProjetoContext {
  projeto: {
    id: string;
    total_questoes: number;
    status: string;
  };
}

// Phase labels for display
const PHASE_LABELS: Record<number, string> = {
  1: 'Vetorizacao & Clusterizacao',
  2: 'Analise por Chunks (Map)',
  3: 'Consolidacao (Reduce)',
  4: 'Verificacao (CoVe)',
};

// Polling interval in milliseconds
const STATUS_POLL_INTERVAL = 2000;

// Minimum questions required for analysis
const MIN_QUESTOES = 5;

export default function AnaliseProfunda() {
  const { projeto } = useOutletContext<ProjetoContext>();
  const addNotification = useNotifications((state) => state.addNotification);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [resumo, setResumo] = useState<AnaliseResumo | null>(null);
  const [status, setStatus] = useState<AnaliseStatus | null>(null);
  const [resultado, setResultado] = useState<AnaliseResultado | null>(null);
  const [selectedDisciplina, setSelectedDisciplina] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Polling ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if analysis can be started
  const canAnalyze = projeto.total_questoes >= MIN_QUESTOES;

  // Determine if analysis is running
  const isRunning = status?.status === 'running' || status?.status === 'pending';

  // Fetch resumo (summary)
  const fetchResumo = useCallback(async () => {
    try {
      const data = await api.getAnaliseResumo(projeto.id);
      setResumo(data);
      return data;
    } catch (err) {
      // 404 is expected if no analysis has been run yet
      if (err instanceof Error && err.message.includes('404')) {
        setResumo(null);
      } else {
        console.error('Error fetching resumo:', err);
      }
      return null;
    }
  }, [projeto.id]);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getAnaliseStatus(projeto.id);
      setStatus(data);
      return data;
    } catch (err) {
      // 404 is expected if no analysis has been run yet
      if (err instanceof Error && err.message.includes('404')) {
        setStatus(null);
      } else {
        console.error('Error fetching status:', err);
      }
      return null;
    }
  }, [projeto.id]);

  // Fetch full results
  const fetchResultado = useCallback(async () => {
    try {
      const data = await api.getAnaliseResultado(projeto.id);
      setResultado(data);

      // Select first discipline by default if none selected
      if (!selectedDisciplina && data.disciplinas.length > 0) {
        setSelectedDisciplina(data.disciplinas[0]);
      }
      return data;
    } catch (err) {
      // 404 is expected if no analysis has been run yet
      if (err instanceof Error && err.message.includes('404')) {
        setResultado(null);
      } else {
        console.error('Error fetching resultado:', err);
      }
      return null;
    }
  }, [projeto.id, selectedDisciplina]);

  // Start polling for status updates
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      const statusData = await fetchStatus();

      if (statusData && (statusData.status === 'completed' || statusData.status === 'failed' || statusData.status === 'cancelled')) {
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        // Fetch results if completed
        if (statusData.status === 'completed') {
          await fetchResultado();
          addNotification({
            type: 'success',
            title: 'Análise concluída',
            message: 'A análise profunda foi concluída com sucesso',
          });
        } else if (statusData.status === 'failed') {
          setError(statusData.error_message || 'A análise falhou');
          addNotification({
            type: 'error',
            title: 'Falha na análise',
            message: statusData.error_message || 'Ocorreu um erro durante a análise',
          });
        }

        // Refresh resumo
        await fetchResumo();
      }
    }, STATUS_POLL_INTERVAL);
  }, [fetchStatus, fetchResultado, fetchResumo, addNotification]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Start analysis
  const handleStartAnalise = async () => {
    setIsStarting(true);
    setError(null);

    try {
      const response = await api.startAnalise(projeto.id);

      addNotification({
        type: 'info',
        title: 'Análise iniciada',
        message: response.message,
      });

      // Fetch initial status
      await fetchStatus();

      // Start polling
      startPolling();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao iniciar análise';
      setError(message);
      addNotification({
        type: 'error',
        title: 'Erro ao iniciar análise',
        message,
      });
    } finally {
      setIsStarting(false);
    }
  };

  // Cancel analysis
  const handleCancelAnalise = async () => {
    if (!status?.job_id) return;

    try {
      await api.cancelAnaliseJob(projeto.id, status.job_id);

      addNotification({
        type: 'info',
        title: 'Análise cancelada',
        message: 'A análise foi cancelada',
      });

      stopPolling();
      await fetchStatus();
      await fetchResumo();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao cancelar analise';
      addNotification({
        type: 'error',
        title: 'Erro ao cancelar',
        message,
      });
    }
  };

  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [resumoData, statusData] = await Promise.all([fetchResumo(), fetchStatus()]);

        // If analysis is running, start polling
        if (statusData && (statusData.status === 'running' || statusData.status === 'pending')) {
          startPolling();
        }

        // If analysis completed, fetch results
        if (resumoData && (resumoData.status === 'completed' || resumoData.status === 'partial')) {
          await fetchResultado();
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();

    return () => {
      stopPolling();
    };
  }, [projeto.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get selected discipline result
  const selectedResult: AnaliseResultadoDisciplina | null =
    selectedDisciplina && resultado?.results[selectedDisciplina]
      ? resultado.results[selectedDisciplina]
      : null;

  // Calculate overall progress based on phase
  const getPhaseProgress = (): number => {
    if (!status) return 0;
    if (status.status === 'completed') return 100;

    const currentPhase = status.current_phase || 0;
    const phaseProgress = status.phase_progress || 0;

    // Each phase is 25% of total
    const baseProgress = (currentPhase - 1) * 25;
    const phaseContribution = (phaseProgress / 100) * 25;

    return Math.min(100, baseProgress + phaseContribution);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-gray-900">Análise Profunda</h2>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-[var(--accent-green)] border-t-transparent rounded-full" />
            <span className="ml-3 text-gray-500">Carregando...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-gray-900">Análise Profunda</h2>
        <div className="flex items-center gap-3">
          {isRunning && (
            <Button variant="secondary" size="sm" onClick={handleCancelAnalise}>
              Cancelar
            </Button>
          )}
          <Button
            onClick={handleStartAnalise}
            disabled={!canAnalyze || isRunning || isStarting}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              canAnalyze && !isRunning && !isStarting
                ? 'bg-[var(--accent-green)] hover:bg-[var(--accent-green-light)] text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {isStarting ? 'Iniciando...' : isRunning ? 'Em andamento...' : 'Gerar Análise'}
          </Button>
        </div>
      </div>

      {/* Warning if not enough questions */}
      {!canAnalyze && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-amber-800 text-[14px]">
            Você precisa de pelo menos {MIN_QUESTOES} questões para gerar uma análise profunda.
            Atualmente: {projeto.total_questoes} questões.
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 text-[14px]">{error}</p>
        </div>
      )}

      {/* Progress indicator when running */}
      {isRunning && status && (
        <Card className="bg-white border-gray-200 rounded-xl">
          <CardBody>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-900 font-medium">Analisando...</span>
                <Badge variant="info">
                  Fase {status.current_phase || 1} de 4
                </Badge>
              </div>

              <PulsingProgressBar
                progress={getPhaseProgress()}
                variant="info"
                statusText={
                  status.current_phase
                    ? `Fase ${status.current_phase}: ${PHASE_LABELS[status.current_phase] || 'Processando'}`
                    : 'Iniciando análise...'
                }
              />

              <div className="grid grid-cols-4 gap-2 mt-4">
                {[1, 2, 3, 4].map((phase) => {
                  const isComplete = status.phases_completed?.includes(`phase_${phase}`) ||
                    (status.current_phase && phase < status.current_phase);
                  const isCurrent = status.current_phase === phase;

                  return (
                    <div
                      key={phase}
                      className={cn(
                        'p-2 rounded-lg text-center text-xs',
                        isComplete
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                          : isCurrent
                          ? 'bg-blue-50 border border-blue-200 text-blue-700'
                          : 'bg-gray-50 border border-gray-200 text-gray-500'
                      )}
                    >
                      <div className="font-medium">Fase {phase}</div>
                      <div className="text-xs mt-1 opacity-75 truncate">
                        {PHASE_LABELS[phase]}
                      </div>
                    </div>
                  );
                })}
              </div>

              {status.total_questoes > 0 && (
                <p className="text-gray-500 text-sm text-center">
                  Analisando {status.total_questoes} questões
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Summary Dashboard */}
      {resumo && !isRunning && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardCard
            label="Disciplinas Analisadas"
            value={`${resumo.disciplinas_analisadas}/${resumo.disciplinas_total}`}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          />
          <DashboardCard
            label="Questões Analisadas"
            value={resumo.questoes_analisadas.toString()}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <DashboardCard
            label="Padrões Encontrados"
            value={resumo.padroes_encontrados.toString()}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
          <DashboardCard
            label="Recomendações"
            value={resumo.recomendacoes.toString()}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Results with discipline tabs */}
      {resultado && !isRunning && resultado.disciplinas.length > 0 && (
        <Card className="bg-white border-gray-200 rounded-xl">
          {/* Discipline Tabs */}
          <div className="border-b border-gray-100 px-4">
            <div className="flex overflow-x-auto gap-1 py-2">
              {resultado.disciplinas.map((disc) => {
                const discResult = resultado.results[disc];
                const isSelected = disc === selectedDisciplina;
                const color = getDisciplinaColor(disc);

                return (
                  <button
                    key={disc}
                    onClick={() => setSelectedDisciplina(disc)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                      isSelected
                        ? 'text-gray-900'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    )}
                    style={isSelected ? { backgroundColor: `${color}15`, borderColor: color, border: '1px solid' } : {}}
                  >
                    {disc}
                    {discResult && (
                      <span className="ml-2 text-xs opacity-75">
                        ({discResult.total_questoes})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Discipline Content */}
          {selectedResult && (
            <CardBody>
              <DisciplinaResultPanel result={selectedResult} />
            </CardBody>
          )}
        </Card>
      )}

      {/* Empty state */}
      {!isRunning && !resultado && canAnalyze && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-gray-500 text-center py-8">
            Clique em "Gerar Análise" para iniciar o processo de análise profunda
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface DashboardCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function DashboardCard({ label, value, icon }: DashboardCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-sm">{label}</span>
        <span className="text-[var(--accent-green)]">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

interface DisciplinaResultPanelProps {
  result: AnaliseResultadoDisciplina;
}

function DisciplinaResultPanel({ result }: DisciplinaResultPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'verified' | 'recommendations'>('overview');

  const hasPatterns =
    (result.analysis_report?.temporal_patterns?.length || 0) > 0 ||
    (result.analysis_report?.similarity_patterns?.length || 0) > 0;

  const hasVerified = result.verified_report && result.verified_report.verification_results.length > 0;

  const hasRecommendations =
    result.analysis_report?.study_recommendations &&
    result.analysis_report.study_recommendations.length > 0;

  return (
    <div className="space-y-4">
      {/* Sub-tabs for discipline */}
      <div className="flex gap-2 border-b border-gray-100 pb-2">
        <TabButton
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        >
          Visão Geral
        </TabButton>
        {hasPatterns && (
          <TabButton
            active={activeTab === 'patterns'}
            onClick={() => setActiveTab('patterns')}
          >
            Padrões ({(result.analysis_report?.temporal_patterns?.length || 0) +
              (result.analysis_report?.similarity_patterns?.length || 0)})
          </TabButton>
        )}
        {hasVerified && (
          <TabButton
            active={activeTab === 'verified'}
            onClick={() => setActiveTab('verified')}
          >
            Insights Verificados ({result.verified_report?.verified_claims || 0})
          </TabButton>
        )}
        {hasRecommendations && (
          <TabButton
            active={activeTab === 'recommendations'}
            onClick={() => setActiveTab('recommendations')}
          >
            Recomendações ({result.analysis_report?.study_recommendations?.length || 0})
          </TabButton>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab result={result} />}
      {activeTab === 'patterns' && <PatternsTab result={result} />}
      {activeTab === 'verified' && <VerifiedTab result={result} />}
      {activeTab === 'recommendations' && <RecommendationsTab result={result} />}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-sm rounded-lg transition-colors',
        active
          ? 'bg-gray-100 text-gray-900 font-medium'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      )}
    >
      {children}
    </button>
  );
}

function OverviewTab({ result }: { result: AnaliseResultadoDisciplina }) {
  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Total de Questões" value={result.total_questoes} />
        <StatBox label="Clusters" value={result.cluster_result?.n_clusters || 0} />
        <StatBox label="Pares Similares" value={result.similar_pairs_count} />
        <StatBox label="Fases Concluídas" value={result.phases_completed.length} />
      </div>

      {/* Cluster Info */}
      {result.cluster_result && result.cluster_result.n_clusters > 0 && (
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="text-gray-900 font-medium mb-3">Distribuição por Clusters</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(result.cluster_result.cluster_sizes).map(([cluster, count]) => (
              <Badge key={cluster} variant="default">
                Cluster {cluster}: {count} questões
              </Badge>
            ))}
          </div>
          {result.cluster_result.silhouette_score !== null &&
            result.cluster_result.silhouette_score !== undefined && (
            <p className="text-gray-500 text-sm mt-2">
              Silhouette Score: {result.cluster_result.silhouette_score.toFixed(3)}
            </p>
          )}
        </div>
      )}

      {/* Analysis Metadata */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h4 className="text-gray-900 font-medium mb-3">Informações da Análise</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {result.banca && (
            <div>
              <span className="text-gray-500">Banca:</span>
              <span className="text-gray-900 ml-2">{result.banca}</span>
            </div>
          )}
          {result.anos && result.anos.length > 0 && (
            <div>
              <span className="text-gray-500">Anos:</span>
              <span className="text-gray-900 ml-2">{result.anos.join(', ')}</span>
            </div>
          )}
          {result.started_at && (
            <div>
              <span className="text-gray-500">Iniciada em:</span>
              <span className="text-gray-900 ml-2">
                {new Date(result.started_at).toLocaleString('pt-BR')}
              </span>
            </div>
          )}
          {result.duration_seconds && (
            <div>
              <span className="text-gray-500">Duração:</span>
              <span className="text-gray-900 ml-2">
                {formatDuration(result.duration_seconds)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Errors if any */}
      {result.errors && result.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h4 className="text-red-700 font-medium mb-2">Erros durante a análise</h4>
          <ul className="text-red-600 text-sm space-y-1">
            {result.errors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PatternsTab({ result }: { result: AnaliseResultadoDisciplina }) {
  const temporalPatterns = result.analysis_report?.temporal_patterns || [];
  const similarityPatterns = result.analysis_report?.similarity_patterns || [];

  return (
    <div className="space-y-6">
      {/* Temporal Patterns */}
      {temporalPatterns.length > 0 && (
        <div>
          <h4 className="text-gray-900 font-medium mb-3">Padrões Temporais</h4>
          <div className="space-y-3">
            {temporalPatterns.map((pattern, idx) => (
              <PatternCard key={`temporal-${idx}`} pattern={pattern} />
            ))}
          </div>
        </div>
      )}

      {/* Similarity Patterns */}
      {similarityPatterns.length > 0 && (
        <div>
          <h4 className="text-gray-900 font-medium mb-3">Padrões de Similaridade</h4>
          <div className="space-y-3">
            {similarityPatterns.map((pattern, idx) => (
              <PatternCard key={`similarity-${idx}`} pattern={pattern} />
            ))}
          </div>
        </div>
      )}

      {temporalPatterns.length === 0 && similarityPatterns.length === 0 && (
        <p className="text-gray-500 text-center py-4">
          Nenhum padrão encontrado nesta análise.
        </p>
      )}
    </div>
  );
}

function PatternCard({ pattern }: { pattern: PatternFinding }) {
  const confidenceColors = {
    high: 'text-emerald-700 bg-emerald-50',
    medium: 'text-amber-700 bg-amber-50',
    low: 'text-gray-600 bg-gray-100',
  };

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="default">{pattern.pattern_type}</Badge>
            <span className={cn('px-2 py-0.5 rounded text-xs', confidenceColors[pattern.confidence])}>
              {pattern.confidence === 'high' ? 'Alta' : pattern.confidence === 'medium' ? 'Média' : 'Baixa'} confiança
            </span>
            {pattern.votes > 1 && (
              <span className="text-gray-400 text-xs">
                ({pattern.votes} votos)
              </span>
            )}
          </div>
          <p className="text-gray-700">{pattern.description}</p>
        </div>
      </div>
      {pattern.evidence_ids.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          Evidências: {pattern.evidence_ids.slice(0, 5).join(', ')}
          {pattern.evidence_ids.length > 5 && ` e mais ${pattern.evidence_ids.length - 5}`}
        </div>
      )}
    </div>
  );
}

function VerifiedTab({ result }: { result: AnaliseResultadoDisciplina }) {
  const verifiedReport = result.verified_report;

  if (!verifiedReport) {
    return (
      <p className="text-gray-500 text-center py-4">
        Nenhuma verificação disponível.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatBox
          label="Claims Originais"
          value={verifiedReport.original_claims}
        />
        <StatBox
          label="Verificados"
          value={verifiedReport.verified_claims}
          variant="success"
        />
        <StatBox
          label="Rejeitados"
          value={verifiedReport.rejected_claims}
          variant="error"
        />
      </div>

      {/* Cleaned Report */}
      {verifiedReport.cleaned_report && (
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="text-gray-900 font-medium mb-3">Relatório Verificado</h4>
          <p className="text-gray-700 whitespace-pre-wrap text-sm">
            {verifiedReport.cleaned_report}
          </p>
        </div>
      )}

      {/* Verification Details */}
      {verifiedReport.verification_results.length > 0 && (
        <div>
          <h4 className="text-gray-900 font-medium mb-3">Detalhes da Verificação</h4>
          <div className="space-y-3">
            {verifiedReport.verification_results.map((vr, idx) => (
              <VerificationCard key={idx} verification={vr} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VerificationCard({ verification }: { verification: VerificationResult }) {
  return (
    <div className={cn(
      'rounded-xl p-4 border',
      verification.is_verified
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-red-50 border-red-200'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
          verification.is_verified ? 'bg-emerald-500' : 'bg-red-500'
        )}>
          {verification.is_verified ? (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <p className={cn(
            'font-medium',
            verification.is_verified ? 'text-emerald-700' : 'text-red-700'
          )}>
            {verification.claim}
          </p>
          <p className="text-gray-600 text-sm mt-1">
            {verification.evidence_summary}
          </p>
          {verification.notes && (
            <p className="text-gray-500 text-xs mt-2 italic">
              {verification.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationsTab({ result }: { result: AnaliseResultadoDisciplina }) {
  const recommendations = result.analysis_report?.study_recommendations || [];

  if (recommendations.length === 0) {
    return (
      <p className="text-gray-500 text-center py-4">
        Nenhuma recomendação disponível.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec, idx) => (
        <div key={idx} className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-green)] flex items-center justify-center text-white font-medium text-sm">
            {idx + 1}
          </div>
          <p className="text-gray-700 flex-1">{rec}</p>
        </div>
      ))}
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: number | string;
  variant?: 'default' | 'success' | 'error';
}

function StatBox({ label, value, variant = 'default' }: StatBoxProps) {
  const variantStyles = {
    default: 'bg-gray-50',
    success: 'bg-emerald-50',
    error: 'bg-red-50',
  };

  const textStyles = {
    default: 'text-gray-900',
    success: 'text-emerald-700',
    error: 'text-red-700',
  };

  return (
    <div className={cn('rounded-xl p-3 text-center', variantStyles[variant])}>
      <div className={cn('text-2xl font-bold', textStyles[variant])}>{value}</div>
      <div className="text-gray-500 text-xs mt-1">{label}</div>
    </div>
  );
}

// Helper function to format duration
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
