// frontend/src/pages/projeto/AnaliseProfunda.tsx
import { useOutletContext } from 'react-router';

interface ProjetoContext {
  projeto: {
    id: string;
    total_questoes: number;
    status: string;
  };
}

export default function AnaliseProfunda() {
  const { projeto } = useOutletContext<ProjetoContext>();

  const canAnalyze = projeto.total_questoes >= 10;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Análise Profunda</h2>
        <button
          disabled={!canAnalyze}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            canAnalyze
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          Gerar Análise
        </button>
      </div>

      {!canAnalyze && (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
          <p className="text-amber-200 text-sm">
            Você precisa de pelo menos 10 questões para gerar uma análise profunda.
            Atualmente: {projeto.total_questoes} questões.
          </p>
        </div>
      )}

      {/* Analysis placeholder */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <p className="text-gray-400 text-center py-8">
          Clique em "Gerar Análise" para iniciar o processo de análise profunda
        </p>
      </div>
    </div>
  );
}
