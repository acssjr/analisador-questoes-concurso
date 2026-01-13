// frontend/src/pages/projeto/ProvasQuestoes.tsx
import { useOutletContext } from 'react-router';

interface ProjetoContext {
  projeto: { id: string };
}

export default function ProvasQuestoes() {
  const { projeto } = useOutletContext<ProjetoContext>();

  return (
    <div className="space-y-6" data-projeto-id={projeto.id}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Provas & Questões</h2>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          Upload Provas
        </button>
      </div>

      {/* Upload area placeholder */}
      <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400">
          Arraste PDFs de provas aqui ou clique para selecionar
        </p>
      </div>

      {/* Queue placeholder */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-md font-medium text-white mb-4">Fila de Processamento</h3>
        <p className="text-gray-400">Nenhuma prova em processamento</p>
      </div>
    </div>
  );
}
