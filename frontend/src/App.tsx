import { useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { Insights } from './pages/Insights';
import { Laboratory } from './pages/Laboratory';
import { NotificationCenter } from './components/features/NotificationCenter';
import { useAppStore } from './store/appStore';

// Dados mockados para desenvolvimento
const MOCK_QUESTOES = [
  {
    id: '1',
    numero: 1,
    ano: 2024,
    banca: 'FCC',
    cargo: 'Analista TRT',
    disciplina: 'Português',
    assunto_pci: 'Sintaxe',
    enunciado: 'Assinale a alternativa em que a oração subordinada adverbial concessiva está corretamente identificada.',
    alternativas: {
      A: 'Embora estivesse cansado, continuou trabalhando.',
      B: 'Como estava cansado, parou de trabalhar.',
      C: 'Quando ficou cansado, parou de trabalhar.',
      D: 'Porque estava cansado, parou de trabalhar.',
      E: 'Se estiver cansado, pare de trabalhar.',
    },
    gabarito: 'A',
    anulada: false,
  },
  {
    id: '2',
    numero: 2,
    ano: 2024,
    banca: 'FCC',
    cargo: 'Analista TRT',
    disciplina: 'Português',
    assunto_pci: 'Ortografia',
    enunciado: 'Todas as palavras estão corretamente grafadas em:',
    alternativas: {
      A: 'Excessão, privilégio, assessor.',
      B: 'Exceção, privilégio, assessor.',
      C: 'Exceção, previlégui, asesor.',
      D: 'Excessão, previlégio, asesor.',
      E: 'Exceção, previlégiu, assessor.',
    },
    gabarito: 'B',
    anulada: false,
  },
  {
    id: '3',
    numero: 3,
    ano: 2023,
    banca: 'CESPE',
    cargo: 'Analista Judiciário',
    disciplina: 'Português',
    assunto_pci: 'Interpretação de Texto',
    enunciado: 'Com base no texto, é correto afirmar que...',
    alternativas: {
      A: 'O autor defende a tese X.',
      B: 'O autor critica a tese Y.',
      C: 'O autor questiona a tese Z.',
      D: 'O autor é neutro em relação às teses.',
      E: 'Nenhuma das alternativas anteriores.',
    },
    gabarito: 'C',
    anulada: true,
    motivo_anulacao: 'Alternativa C ambígua e mal formulada.',
  },
  {
    id: '4',
    numero: 4,
    ano: 2024,
    banca: 'FCC',
    cargo: 'Técnico TRT',
    disciplina: 'Matemática',
    assunto_pci: 'Regra de Três',
    enunciado: 'Se 5 operários constroem um muro em 12 dias, quantos dias serão necessários para 8 operários construírem o mesmo muro?',
    alternativas: {
      A: '7,5 dias',
      B: '8 dias',
      C: '9 dias',
      D: '10 dias',
      E: '12 dias',
    },
    gabarito: 'A',
    anulada: false,
  },
  {
    id: '5',
    numero: 5,
    ano: 2023,
    banca: 'FCC',
    cargo: 'Analista TRT',
    disciplina: 'Português',
    assunto_pci: 'Crase',
    enunciado: 'A crase está corretamente empregada em:',
    alternativas: {
      A: 'Refiro-me à aquela pessoa.',
      B: 'Fui à casa de Pedro.',
      C: 'Cheguei à uma conclusão.',
      D: 'Dirigiu-se à Brasília.',
      E: 'Saiu à pé.',
    },
    gabarito: 'B',
    anulada: false,
  },
];

const MOCK_DATASET = {
  id: 'mock-1',
  nome: 'FCC Analista 2024 (MOCK)',
  descricao: 'Dados mockados para desenvolvimento',
  total_questoes: MOCK_QUESTOES.length,
  data_criacao: new Date().toISOString(),
};

function App() {
  const modoCanvas = useAppStore(state => state.modoCanvas);
  const setDatasets = useAppStore(state => state.setDatasets);
  const setActiveDataset = useAppStore(state => state.setActiveDataset);
  const setQuestoes = useAppStore(state => state.setQuestoes);

  useEffect(() => {
    // Carrega dados mockados ao iniciar
    setDatasets([MOCK_DATASET]);
    setActiveDataset(MOCK_DATASET);
    setQuestoes(MOCK_QUESTOES);
  }, [setDatasets, setActiveDataset, setQuestoes]);

  return (
    <>
      <MainLayout>
        {modoCanvas === 'insights' ? <Insights /> : <Laboratory />}
      </MainLayout>
      <NotificationCenter />
    </>
  );
}

export default App;
