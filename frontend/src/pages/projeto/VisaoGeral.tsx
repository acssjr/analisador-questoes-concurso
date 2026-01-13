// frontend/src/pages/projeto/VisaoGeral.tsx
import { useOutletContext } from 'react-router';

interface ProjetoContext {
  projeto: {
    id: string;
    nome: string;
    total_provas: number;
    total_questoes: number;
    status: string;
  };
}

export default function VisaoGeral() {
  const { projeto } = useOutletContext<ProjetoContext>();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Visão Geral</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Provas</p>
          <p className="text-2xl font-bold text-white">{projeto.total_provas}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Questões</p>
          <p className="text-2xl font-bold text-white">{projeto.total_questoes}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Status</p>
          <p className="text-2xl font-bold text-white capitalize">{projeto.status}</p>
        </div>
      </div>

      {/* Taxonomy placeholder */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-md font-medium text-white mb-4">Taxonomia do Edital</h3>
        <p className="text-gray-400">Em breve: árvore de disciplinas e tópicos</p>
      </div>
    </div>
  );
}
