/**
 * Mock data for tests
 */
import type {
  Questao,
  QuestaoCompleta,
  Edital,
  IncidenciaNode,
  FiltrosGlobais,
  Dataset,
  ConteudoProgramatico,
} from '../types';

export const mockFiltros: FiltrosGlobais = {
  status: 'todas',
  anos: [],
  bancas: [],
};

export const mockQuestoes: QuestaoCompleta[] = [
  {
    id: 'q1',
    numero: 1,
    ano: 2023,
    banca: 'CESPE',
    cargo: 'Analista',
    disciplina: 'Direito Constitucional',
    enunciado: 'Questão sobre princípios constitucionais...',
    alternativas: {
      A: 'Alternativa A',
      B: 'Alternativa B',
      C: 'Alternativa C',
      D: 'Alternativa D',
      E: 'Alternativa E',
    },
    gabarito: 'A',
    anulada: false,
  },
  {
    id: 'q2',
    numero: 2,
    ano: 2023,
    banca: 'CESPE',
    cargo: 'Analista',
    disciplina: 'Direito Administrativo',
    enunciado: 'Questão sobre atos administrativos...',
    alternativas: {
      A: 'Alternativa A',
      B: 'Alternativa B',
      C: 'Alternativa C',
      D: 'Alternativa D',
      E: 'Alternativa E',
    },
    gabarito: 'B',
    anulada: false,
  },
  {
    id: 'q3',
    numero: 3,
    ano: 2022,
    banca: 'FCC',
    cargo: 'Técnico',
    disciplina: 'Língua Portuguesa',
    enunciado: 'Questão sobre interpretação de texto...',
    alternativas: {
      A: 'Alternativa A',
      B: 'Alternativa B',
      C: 'Alternativa C',
      D: 'Alternativa D',
      E: 'Alternativa E',
    },
    gabarito: 'C',
    anulada: true,
    motivo_anulacao: 'Questão com duas respostas corretas',
  },
  {
    id: 'q4',
    numero: 4,
    ano: 2022,
    banca: 'FCC',
    cargo: 'Técnico',
    disciplina: 'Raciocínio Lógico',
    enunciado: 'Questão sobre proposições lógicas...',
    alternativas: {
      A: 'Alternativa A',
      B: 'Alternativa B',
      C: 'Alternativa C',
      D: 'Alternativa D',
      E: 'Alternativa E',
    },
    gabarito: 'D',
    anulada: false,
  },
];

export const mockTaxonomia: ConteudoProgramatico = {
  disciplinas: [
    {
      nome: 'Língua Portuguesa',
      itens: [
        { id: '1', texto: 'Interpretação de texto', filhos: [] },
        { id: '2', texto: 'Gramática', filhos: [] },
      ],
    },
    {
      nome: 'Raciocínio Lógico',
      itens: [
        { id: '1', texto: 'Proposições', filhos: [] },
        { id: '2', texto: 'Lógica de argumentação', filhos: [] },
      ],
    },
  ],
};

export const mockEdital: Edital = {
  id: 'edital-123',
  nome: 'Concurso TRT 2024',
  arquivo_url: '/files/edital.pdf',
  data_upload: '2024-01-15T10:00:00Z',
  total_provas: 3,
  total_questoes: 180,
  banca: 'FCC',
  orgao: 'TRT',
  ano: 2024,
  cargos: ['Analista Judiciário', 'Técnico Judiciário'],
  conteudo_programatico: mockTaxonomia,
};

export const mockIncidencia: IncidenciaNode[] = [
  {
    nome: 'Língua Portuguesa',
    count: 30,
    percentual: 25,
    children: [
      {
        nome: 'Interpretação de texto',
        count: 18,
        percentual: 15,
        children: [],
      },
      {
        nome: 'Gramática',
        count: 12,
        percentual: 10,
        children: [],
      },
    ],
  },
  {
    nome: 'Raciocínio Lógico',
    count: 20,
    percentual: 16.67,
    children: [
      {
        nome: 'Proposições',
        count: 12,
        percentual: 10,
        children: [],
      },
      {
        nome: 'Lógica de argumentação',
        count: 8,
        percentual: 6.67,
        children: [],
      },
    ],
  },
  {
    nome: 'Direito Constitucional',
    count: 25,
    percentual: 20.83,
    children: [],
  },
];

export const mockDatasets: Dataset[] = [
  {
    id: 'ds1',
    nome: 'Provas TRT 2023',
    total_questoes: 120,
    data_criacao: '2023-06-01T10:00:00Z',
  },
  {
    id: 'ds2',
    nome: 'Provas TRF 2022',
    total_questoes: 80,
    data_criacao: '2022-12-15T14:30:00Z',
  },
];

export const mockDashboardStats = {
  total_questoes: 200,
  total_regulares: 185,
  total_anuladas: 15,
  disciplinas: {
    'Língua Portuguesa': 50,
    'Raciocínio Lógico': 40,
    'Direito Constitucional': 35,
    'Direito Administrativo': 30,
    'Informática': 25,
    'Conhecimentos Específicos': 20,
  },
  assuntos_top: [
    { assunto: 'Interpretação de texto', count: 30, percentual: 15 },
    { assunto: 'Princípios constitucionais', count: 25, percentual: 12.5 },
    { assunto: 'Atos administrativos', count: 20, percentual: 10 },
  ],
  anos: [
    { ano: 2024, count: 60 },
    { ano: 2023, count: 80 },
    { ano: 2022, count: 60 },
  ],
};
