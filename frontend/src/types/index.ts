// Tipos principais do domínio

export interface Questao {
  id: string;
  numero: number;
  ano: number;
  banca: string;
  cargo: string;
  disciplina: string;
  assunto_pci?: string;
  enunciado: string;
  alternativas: {
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
  };
  gabarito: string;
  anulada: boolean;
  motivo_anulacao?: string;
  imagens?: string[];
  classificacao?: Classificacao;
}

export interface Classificacao {
  disciplina: string;
  assunto: string;
  topico: string;
  subtopico: string;
  conceito_especifico: string;
  confianca_disciplina: number;
  confianca_assunto: number;
  confianca_topico: number;
  confianca_subtopico: number;
  conceito_testado: string;
  habilidade_bloom: 'lembrar' | 'entender' | 'aplicar' | 'analisar' | 'avaliar' | 'criar';
  nivel_dificuldade: 'basico' | 'intermediario' | 'avancado';
  conceitos_adjacentes?: string[];
  item_edital_path?: string;
}

// Estrutura hierárquica do conteúdo programático - RECURSIVA E ADAPTATIVA
// Suporta 1 a N níveis de profundidade conforme o edital real

export interface ItemConteudo {
  id: string | null;  // null para itens sem numeração
  texto: string;
  filhos: ItemConteudo[];
}

export interface DisciplinaConteudo {
  nome: string;
  itens: ItemConteudo[];
  // Legacy fields for backward compatibility during migration
  assuntos?: AssuntoConteudo[];
}

export interface ConteudoProgramatico {
  disciplinas: DisciplinaConteudo[];
}

// Legacy types for backward compatibility
export interface AssuntoConteudo {
  nome: string;
  topicos?: TopicoConteudo[];
}

export interface TopicoConteudo {
  nome: string;
  subtopicos?: string[];
}

// Estrutura para análise de incidência
export interface IncidenciaNode {
  nome: string;
  count: number;
  percentual: number;
  children?: IncidenciaNode[];
  questoes?: Questao[];
  confianca_media?: number;
}

export interface AnaliseAlternativa {
  letra: string;
  correta: boolean;
  justificativa: string;
}

export interface QuestaoCompleta extends Questao {
  classificacao?: Classificacao;
  analise_alternativas?: AnaliseAlternativa[];
  tags?: string[];
}

export interface QuestaoSimilar {
  questao_id: string;
  questao: Questao;
  similaridade: number;
}

export interface Cluster {
  id: string;
  conceito_comum: string;
  questoes: Questao[];
  avg_similaridade: number;
}

export interface Dataset {
  id: string;
  nome: string;
  descricao?: string;
  total_questoes: number;
  data_criacao: string;
}

export interface DashboardStats {
  total_questoes: number;
  total_regulares: number;
  total_anuladas: number;
  disciplinas: { [key: string]: number };
  assuntos_top: Array<{ assunto: string; count: number; percentual: number }>;
  anos: Array<{ ano: number; count: number }>;
}

export interface FiltrosGlobais {
  status: 'todas' | 'regulares' | 'anuladas';
  anos: number[];
  bancas: string[];
}

export type ModoCanvas = 'insights' | 'laboratorio';
export type TabLaboratorio = 'distribuicao' | 'similaridade' | 'temporal' | 'questoes';

// Edital types
export interface Edital {
  id: string;
  nome: string;
  arquivo_url: string;
  data_upload: string;
  conteudo_programatico_url?: string;
  conteudo_programatico?: ConteudoProgramatico;
  taxonomia?: ConteudoProgramatico;  // Alias for conteudo_programatico used by some components
  total_provas: number;
  total_questoes: number;
  banca?: string;
  orgao?: string;
  ano?: number;
  cargo?: string;   // Single cargo for display
  cargos?: string[];
}

export interface EditalUploadResponse {
  success: boolean;
  edital_id: string;
  nome: string;
  banca?: string;
  cargos: string[];  // Lista de todos os cargos do edital
  ano?: number;
  disciplinas: string[];
}

export interface ConteudoProgramaticoUploadResponse {
  success: boolean;
  edital_id: string;
  total_disciplinas: number;
  total_assuntos: number;
  total_topicos: number;
  taxonomia: ConteudoProgramatico;
}

export interface EditalComAnalise extends Edital {
  questoes: Questao[];
  incidencia: IncidenciaNode[];
}

// Projeto types
export interface Projeto {
  id: string;
  nome: string;
  descricao?: string;
  banca?: string;
  cargo?: string;
  ano?: number;
  status: 'configurando' | 'coletando' | 'analisando' | 'concluido';
  total_provas: number;
  total_questoes: number;
  total_questoes_validas: number;
  total_anuladas: number;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  edital_id?: string;
  edital_nome?: string;
  has_taxonomia?: boolean;
}

export interface ProjetoCreate {
  nome: string;
  descricao?: string;
  banca?: string;
  cargo?: string;
  ano?: number;
}

export interface ProjetoListResponse {
  projetos: Projeto[];
  total: number;
}

export interface ProjetoStats {
  total_provas: number;
  total_questoes: number;
  total_questoes_validas: number;
  total_anuladas: number;
  provas_por_ano: Record<number, number>;
  questoes_por_disciplina: Record<string, number>;
  status: string;
  pronto_para_analise: boolean;
}

// =============================================================================
// Analise Profunda Types
// =============================================================================

export type AnaliseStatusType = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type PatternConfidence = 'high' | 'medium' | 'low';

export interface PatternFinding {
  pattern_type: string;
  description: string;
  evidence_ids: string[];
  confidence: PatternConfidence;
  votes: number;
}

export interface VerificationResult {
  claim: string;
  verification_question: string;
  evidence_ids: string[];
  evidence_summary: string;
  is_verified: boolean;
  confidence: PatternConfidence;
  notes?: string;
}

export interface ClusterResult {
  n_clusters: number;
  cluster_sizes: Record<string, number>;
  silhouette_score?: number;
}

export interface AnalysisReport {
  disciplina: string;
  total_questoes: number;
  temporal_patterns: PatternFinding[];
  similarity_patterns: PatternFinding[];
  difficulty_analysis: Record<string, unknown>;
  trap_analysis: Record<string, unknown>;
  study_recommendations: string[];
  raw_text?: string;
}

export interface VerifiedReport {
  original_claims: number;
  verified_claims: number;
  rejected_claims: number;
  verification_results: VerificationResult[];
  cleaned_report?: string;
}

export interface AnaliseIniciarRequest {
  disciplina?: string;
  skip_phases?: number[];
}

export interface AnaliseIniciarResponse {
  job_id: string;
  projeto_id: string;
  disciplina: string;
  status: string;
  message: string;
}

export interface AnaliseStatus {
  job_id: string;
  projeto_id: string;
  disciplina: string;
  status: AnaliseStatusType;
  current_phase?: number;
  phase_progress?: number;
  phases_completed: string[];
  total_questoes: number;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  error_message?: string;
}

export interface AnaliseResultadoDisciplina {
  job_id: string;
  disciplina: string;
  status: AnaliseStatusType;
  total_questoes: number;
  banca?: string;
  anos: number[];
  cluster_result?: ClusterResult;
  similar_pairs_count: number;
  chunk_digests_count: number;
  analysis_report?: AnalysisReport;
  verified_report?: VerifiedReport;
  phases_completed: string[];
  errors: string[];
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
}

export interface AnaliseResultado {
  projeto_id: string;
  disciplinas: string[];
  total_jobs: number;
  completed_jobs: number;
  results: Record<string, AnaliseResultadoDisciplina>;
}

export interface AnaliseResumo {
  projeto_id: string;
  status: 'pending' | 'running' | 'partial' | 'completed' | 'failed';
  disciplinas_analisadas: number;
  disciplinas_total: number;
  questoes_analisadas: number;
  padroes_encontrados: number;
  recomendacoes: number;
  last_updated?: string;
}
