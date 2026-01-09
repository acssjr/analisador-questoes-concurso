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
}

export interface Classificacao {
  disciplina: string;
  assunto: string;
  topico: string;
  subtopico: string;
  conceito_especifico: string;
  confianca_assunto: number;
  confianca_topico: number;
  confianca_subtopico: number;
  confianca_conceito: number;
  conceito_testado: string;
  habilidade_bloom: 'lembrar' | 'entender' | 'aplicar' | 'analisar' | 'avaliar' | 'criar';
  nivel_dificuldade: 'basico' | 'intermediario' | 'avancado';
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
  total_provas: number;
}

export interface EditalUploadResponse {
  edital_id: string;
  nome: string;
  status: string;
}
