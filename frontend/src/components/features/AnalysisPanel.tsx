import { useAppStore } from '../../store/appStore';
import { Badge } from '../ui';

export function AnalysisPanel() {
  const questaoSelecionada = useAppStore(state => state.questaoSelecionada);
  const setPainelDireito = useAppStore(state => state.setPainelDireito);

  if (!questaoSelecionada) return null;

  const { numero, ano, banca, cargo, disciplina, enunciado, alternativas, gabarito, anulada } = questaoSelecionada;

  return (
    <aside className="w-96 surface border-l border-dark-border overflow-y-auto flex-shrink-0 animate-slideInRight">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-mono text-sm text-text-secondary">
                Questão #{numero} • {banca} • {ano} • {cargo}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {anulada ? (
                <Badge variant="warning">Anulada</Badge>
              ) : (
                <Badge variant="success">Normal</Badge>
              )}
              <Badge variant="disciplina" disciplina={disciplina}>
                {disciplina}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2 ml-4">
            <button className="p-1 hover:bg-white hover:bg-opacity-5 rounded">📌</button>
            <button
              onClick={() => setPainelDireito(false)}
              className="p-1 hover:bg-white hover:bg-opacity-5 rounded"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Bloco 1: Enunciado e Alternativas */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-secondary mb-3">ENUNCIADO</h3>
          <p className="text-sm text-text-primary leading-relaxed mb-4">{enunciado}</p>

          <h4 className="text-sm font-medium text-text-secondary mb-2">ALTERNATIVAS</h4>
          <div className="space-y-2">
            {Object.entries(alternativas).map(([letra, texto]) => (
              <div
                key={letra}
                className={`p-2 rounded text-sm ${
                  letra === gabarito
                    ? 'border-l-2 border-semantic-success bg-semantic-success bg-opacity-5'
                    : 'border-l-2 border-transparent'
                }`}
              >
                <span className="font-mono font-medium">{letra})</span> {texto}
              </div>
            ))}
          </div>

          {anulada && (
            <div className="mt-4 p-3 bg-semantic-warning bg-opacity-10 border border-semantic-warning rounded">
              <p className="text-xs text-semantic-warning">
                ⚠️ Questão anulada{questaoSelecionada.motivo_anulacao && `: ${questaoSelecionada.motivo_anulacao}`}
              </p>
            </div>
          )}
        </div>

        {/* Bloco 2: Classificação Hierárquica */}
        {questaoSelecionada.classificacao && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-text-secondary mb-3">CLASSIFICAÇÃO</h3>
            <div className="space-y-2 text-sm">
              <div className="pl-0">
                📚 <span className="font-medium">{questaoSelecionada.classificacao.disciplina}</span>
              </div>
              <div className="pl-4">
                📖 {questaoSelecionada.classificacao.assunto}{' '}
                <Badge variant="info">{Math.round(questaoSelecionada.classificacao.confianca_assunto * 100)}%</Badge>
              </div>
              <div className="pl-8">
                🔹 {questaoSelecionada.classificacao.topico}{' '}
                <Badge variant="info">{Math.round(questaoSelecionada.classificacao.confianca_topico * 100)}%</Badge>
              </div>
              <div className="pl-12">
                🔸 {questaoSelecionada.classificacao.subtopico}{' '}
                <Badge variant="info">{Math.round(questaoSelecionada.classificacao.confianca_subtopico * 100)}%</Badge>
              </div>
              <div className="pl-16">
                ⚡ {questaoSelecionada.classificacao.conceito_especifico}
              </div>
            </div>

            <div className="mt-4 p-3 bg-dark-surface rounded">
              <p className="text-xs font-medium text-text-secondary mb-1">CONCEITO TESTADO</p>
              <p className="text-sm text-text-primary">{questaoSelecionada.classificacao.conceito_testado}</p>
            </div>

            <div className="mt-3 flex gap-2">
              <Badge variant="default">{questaoSelecionada.classificacao.habilidade_bloom}</Badge>
              <Badge variant="default">{questaoSelecionada.classificacao.nivel_dificuldade}</Badge>
            </div>
          </div>
        )}

        {/* Bloco 3: Análise de Alternativas */}
        {questaoSelecionada.analise_alternativas && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-text-secondary mb-3">ANÁLISE DE ALTERNATIVAS</h3>
            <div className="space-y-3">
              {questaoSelecionada.analise_alternativas.map(({ letra, correta, justificativa }) => (
                <div key={letra} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-medium">{letra}</span>
                    {correta ? (
                      <Badge variant="success">✅ Correto</Badge>
                    ) : (
                      <Badge variant="error">❌ Incorreto</Badge>
                    )}
                  </div>
                  <p className="text-text-secondary text-xs pl-6">{justificativa}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bloco 4: Contexto e Padrões */}
        {questaoSelecionada.tags && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">TAGS</h3>
            <div className="flex flex-wrap gap-2">
              {questaoSelecionada.tags.map(tag => (
                <Badge key={tag} variant="default">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
