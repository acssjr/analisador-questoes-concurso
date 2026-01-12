import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Card, CardHeader, CardBody, Badge, Button } from '../components/ui';
import { calcularDistribuicao, filtrarQuestoes } from '../utils/calculations';
import { getDisciplinaColor } from '../utils/colors';
import { EditalWorkflowModal } from '../components/features/EditalWorkflowModal';

export function Insights() {
  const questoes = useAppStore(state => state.questoes);
  const activeEdital = useAppStore(state => state.activeEdital);
  const activeDisciplina = useAppStore(state => state.activeDisciplina);
  const filtros = useAppStore(state => state.filtros);
  const setModoCanvas = useAppStore(state => state.setModoCanvas);
  const setPainelDireito = useAppStore(state => state.setPainelDireito);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Se não há edital ativo, mostrar tela inicial
  if (!activeEdital) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-center max-w-lg">
            <div className="text-8xl mb-6">📊</div>
            <h1 className="text-3xl font-bold text-text-primary mb-4">
              Analisador de Questões de Concurso
            </h1>
            <p className="text-text-secondary mb-8">
              Importe um edital com o conteúdo programático e as provas anteriores
              para analisar a incidência de assuntos e identificar o que mais cai.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setIsUploadModalOpen(true)}
            >
              📋 Importar Edital e Provas
            </Button>
            <div className="mt-8 p-4 bg-dark-surface rounded-lg text-left">
              <p className="text-sm font-medium text-text-primary mb-2">Como funciona:</p>
              <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
                <li>Faça upload do PDF do edital do concurso</li>
                <li>Adicione o conteúdo programático detalhado (opcional)</li>
                <li>Importe as provas anteriores em PDF</li>
                <li>O sistema extrai e classifica as questões automaticamente</li>
                <li>Analise a incidência em 5 níveis hierárquicos</li>
              </ol>
            </div>
          </div>
        </div>
        <EditalWorkflowModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadSuccess={() => setIsUploadModalOpen(false)}
        />
      </>
    );
  }

  const questoesFiltradas = filtrarQuestoes(questoes, { ...filtros, disciplina: activeDisciplina || undefined });

  const totalRegulares = questoesFiltradas.filter(q => !q.anulada).length;
  const totalAnuladas = questoesFiltradas.filter(q => q.anulada).length;

  const distribuicaoAssuntos = calcularDistribuicao(questoesFiltradas, 'assunto_pci');
  const top3Assuntos = distribuicaoAssuntos.slice(0, 3);

  if (!activeDisciplina) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-secondary">Selecione uma disciplina na barra lateral</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Insights - {activeDisciplina}</h1>
          <p className="text-sm text-text-secondary">Visão automática e inteligente da disciplina</p>
        </div>
        <Button variant="ghost" onClick={() => setModoCanvas('laboratorio')}>
          🔬 Abrir Laboratório Avançado
        </Button>
      </div>

      {/* Overview Cards (3 colunas) */}
      <div className="grid grid-cols-3 gap-4">
        {/* Card 1: Total de Questões */}
        <Card>
          <CardHeader title="Total de Questões" />
          <CardBody>
            <div className="text-4xl font-bold text-text-primary text-mono mb-2">
              {questoesFiltradas.length}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="success">{totalRegulares}</Badge>
                <span className="text-text-secondary">Regulares</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="warning">{totalAnuladas}</Badge>
                <span className="text-text-secondary">Anuladas</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Card 2: Distribuição por Assunto */}
        <Card>
          <CardHeader title="Top 3 Assuntos" />
          <CardBody>
            <div className="space-y-3">
              {top3Assuntos.map((item, index) => (
                <div key={item.categoria}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-text-primary">{index + 1}. {item.categoria}</span>
                    <span className="text-xs font-mono text-text-secondary">
                      {item.percentual.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.percentual}%`,
                        backgroundColor: getDisciplinaColor(activeDisciplina),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Card 3: Alertas */}
        <Card className="border-semantic-warning border-opacity-50">
          <CardHeader title="Alertas Críticos" />
          <CardBody>
            {totalAnuladas > 0 ? (
              <div className="space-y-2">
                <div className="p-2 bg-semantic-warning bg-opacity-10 rounded">
                  <p className="text-xs text-semantic-warning">
                    ⚠️ {totalAnuladas} questões anuladas detectadas
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    useAppStore.getState().setFiltros({ status: 'anuladas' });
                    setModoCanvas('laboratorio');
                  }}
                >
                  Ver questões anuladas →
                </Button>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">Nenhum alerta no momento</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Distribuição Visual */}
      <Card>
        <CardHeader
          title="Distribuição de Assuntos"
          subtitle={`${distribuicaoAssuntos.length} assuntos identificados`}
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-3">
            {distribuicaoAssuntos.map(item => (
              <button
                key={item.categoria}
                onClick={() => {
                  // Abrir laboratório filtrado por este assunto
                  setModoCanvas('laboratorio');
                }}
                className="p-3 surface hover:bg-opacity-80 transition-colors text-left rounded-lg"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-text-primary">{item.categoria}</span>
                  <Badge variant="disciplina" disciplina={activeDisciplina}>
                    {item.count}
                  </Badge>
                </div>
                <div className="h-1.5 bg-dark-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${item.percentual}%`,
                      backgroundColor: getDisciplinaColor(activeDisciplina),
                    }}
                  />
                </div>
                <span className="text-xs text-mono text-text-secondary mt-1">
                  {item.percentual.toFixed(1)}%
                </span>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Questões Recentes */}
      <Card>
        <CardHeader
          title="Questões Recentes"
          subtitle="Últimas questões desta disciplina"
          action={
            <Button variant="ghost" size="sm" onClick={() => setModoCanvas('laboratorio')}>
              Ver todas →
            </Button>
          }
        />
        <CardBody>
          <div className="space-y-2">
            {questoesFiltradas.slice(0, 5).map(questao => (
              <button
                key={questao.id}
                onClick={() => setPainelDireito(true, questao)}
                className="w-full p-3 surface hover:bg-opacity-80 transition-all text-left rounded border-l-2 border-transparent hover:border-l-2"
                style={{
                  '--hover-color': getDisciplinaColor(activeDisciplina),
                } as any}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderLeftColor = getDisciplinaColor(activeDisciplina);
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent';
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-mono text-xs text-text-secondary">
                      #{questao.numero}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {questao.banca} • {questao.ano}
                    </span>
                  </div>
                  {questao.anulada && <Badge variant="warning">Anulada</Badge>}
                </div>
                <p className="text-sm text-text-primary line-clamp-2">{questao.enunciado}</p>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
