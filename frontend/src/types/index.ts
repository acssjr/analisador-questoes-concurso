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

// Estrutura hierárquica do conteúdo programático
export interface ConteudoProgramatico {
  disciplinas: DisciplinaConteudo[];
}

export interface DisciplinaConteudo {
  nome: string;
  assuntos: AssuntoConteudo[];
}

export interface AssuntoConteudo {
  nome: string;
  topicos: TopicoConteudo[];
}

export interface TopicoConteudo {
  nome: string;
  subtopicos: string[];
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
  total_provas: number;
  total_questoes: number;
  banca?: string;
  orgao?: string;
  ano?: number;
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
