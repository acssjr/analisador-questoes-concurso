import { useAppStore } from '../store/appStore';
import { Card, CardHeader, CardBody, Badge, Button } from '../components/ui';
import type { IncidenciaNode, Questao } from '../types';

// Componente de nó da árvore hierárquica
function IncidenciaTreeNode({
  node,
  level = 0,
  path = '',
  onSelectQuestoes
}: {
  node: IncidenciaNode;
  level?: number;
  path?: string;
  onSelectQuestoes: (questoes: Questao[], titulo: string) => void;
}) {
  const expandedNodes = useAppStore(state => state.expandedNodes);
  const toggleNodeExpanded = useAppStore(state => state.toggleNodeExpanded);

  const currentPath = path ? `${path} > ${node.nome}` : node.nome;
  const isExpanded = expandedNodes.has(currentPath);
  const hasChildren = node.children && node.children.length > 0;

  // Ícones por nível
  const levelIcons = ['📚', '📖', '🔹', '🔸', '⚡'];
  const icon = levelIcons[level] || '•';

  // Cores por nível (mais escuro = mais profundo)
  const levelColors = [
    'bg-disciplinas-portugues',
    'bg-disciplinas-matematica',
    'bg-disciplinas-raciocinio',
    'bg-disciplinas-informatica',
    'bg-disciplinas-direito'
  ];

  return (
    <div className="select-none">
      <div
        className={`
          flex items-center gap-2 p-2 rounded-lg cursor-pointer
          hover:bg-dark-surface transition-colors
          ${level === 0 ? 'font-semibold' : ''}
        `}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => {
          if (hasChildren) {
            toggleNodeExpanded(currentPath);
          } else if (node.questoes && node.questoes.length > 0) {
            onSelectQuestoes(node.questoes, currentPath);
          }
        }}
      >
        {/* Expand/Collapse indicator */}
        {hasChildren && (
          <span className="text-text-secondary w-4 text-center">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && <span className="w-4" />}

        {/* Icon */}
        <span>{icon}</span>

        {/* Nome */}
        <span className="text-text-primary flex-1">{node.nome}</span>

        {/* Contagem e percentual */}
        <div className="flex items-center gap-2">
          <Badge variant="info" className="font-mono text-xs">
            {node.count} {node.count === 1 ? 'questão' : 'questões'}
          </Badge>
          <div className="w-20 h-2 bg-dark-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${levelColors[level % levelColors.length]}`}
              style={{ width: `${Math.min(node.percentual, 100)}%` }}
            />
          </div>
          <span className="text-xs text-text-secondary font-mono w-12 text-right">
            {node.percentual.toFixed(1)}%
          </span>
        </div>

        {/* Confiança média */}
        {node.confianca_media !== undefined && (
          <span className="text-xs text-text-secondary">
            ({(node.confianca_media * 100).toFixed(0)}% conf.)
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child, idx) => (
            <IncidenciaTreeNode
              key={`${currentPath}-${child.nome}-${idx}`}
              node={child}
              level={level + 1}
              path={currentPath}
              onSelectQuestoes={onSelectQuestoes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function EditalAnalysis() {
  const activeEdital = useAppStore(state => state.activeEdital);
  const questoes = useAppStore(state => state.questoes);
  const incidencia = useAppStore(state => state.incidencia);
  const setModoCanvas = useAppStore(state => state.setModoCanvas);
  const setPainelDireito = useAppStore(state => state.setPainelDireito);
  const setActiveEdital = useAppStore(state => state.setActiveEdital);

  if (!activeEdital) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-secondary">Nenhum edital selecionado</p>
      </div>
    );
  }

  const totalQuestoes = questoes.length;
  const totalAnuladas = questoes.filter(q => q.anulada).length;
  const totalRegulares = totalQuestoes - totalAnuladas;

  // Agrupar por ano
  const questoesPorAno = questoes.reduce((acc, q) => {
    acc[q.ano] = (acc[q.ano] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const handleSelectQuestoes = (questoesNode: Questao[], _titulo: string) => {
    if (questoesNode.length > 0) {
      setPainelDireito(true, questoesNode[0] as any);
    }
  };

  const handleVoltar = () => {
    setActiveEdital(null);
  };

  return (
    <div className="space-y-6">
      {/* Header do Edital */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="sm" onClick={handleVoltar}>
              ← Voltar
            </Button>
            <Badge variant="success">Edital Ativo</Badge>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">
            {activeEdital.nome}
          </h1>
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            {activeEdital.banca && <span>🏛️ {activeEdital.banca}</span>}
            {activeEdital.ano && <span>📅 {activeEdital.ano}</span>}
            {activeEdital.orgao && <span>🏢 {activeEdital.orgao}</span>}
          </div>
        </div>
        <Button variant="ghost" onClick={() => setModoCanvas('laboratorio')}>
          🔬 Abrir Laboratório Avançado
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total de Questões */}
        <Card>
          <CardBody>
            <div className="text-center">
              <div className="text-4xl font-bold text-text-primary font-mono mb-1">
                {totalQuestoes}
              </div>
              <p className="text-sm text-text-secondary">Questões Extraídas</p>
            </div>
          </CardBody>
        </Card>

        {/* Regulares */}
        <Card>
          <CardBody>
            <div className="text-center">
              <div className="text-4xl font-bold text-semantic-success font-mono mb-1">
                {totalRegulares}
              </div>
              <p className="text-sm text-text-secondary">Questões Válidas</p>
            </div>
          </CardBody>
        </Card>

        {/* Anuladas */}
        <Card className={totalAnuladas > 0 ? 'border-semantic-warning' : ''}>
          <CardBody>
            <div className="text-center">
              <div className="text-4xl font-bold text-semantic-warning font-mono mb-1">
                {totalAnuladas}
              </div>
              <p className="text-sm text-text-secondary">Anuladas</p>
            </div>
          </CardBody>
        </Card>

        {/* Provas */}
        <Card>
          <CardBody>
            <div className="text-center">
              <div className="text-4xl font-bold text-text-primary font-mono mb-1">
                {activeEdital.total_provas || 0}
              </div>
              <p className="text-sm text-text-secondary">Provas Analisadas</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Anos analisados */}
      {Object.keys(questoesPorAno).length > 0 && (
        <Card>
          <CardHeader title="Distribuição por Ano" />
          <CardBody>
            <div className="flex items-center gap-4 flex-wrap">
              {Object.entries(questoesPorAno)
                .sort(([a], [b]) => Number(b) - Number(a))
                .map(([ano, count]) => (
                  <div key={ano} className="flex items-center gap-2">
                    <Badge variant="info">{ano}</Badge>
                    <span className="text-sm text-text-secondary">{count} questões</span>
                  </div>
                ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Árvore de Incidência Hierárquica */}
      <Card>
        <CardHeader
          title="Análise de Incidência por Assunto"
          subtitle="Clique para expandir e ver os níveis hierárquicos: Disciplina → Assunto → Tópico → Subtópico → Conceito"
        />
        <CardBody>
          {incidencia.length > 0 ? (
            <div className="space-y-1">
              {incidencia.map((node, idx) => (
                <IncidenciaTreeNode
                  key={`${node.nome}-${idx}`}
                  node={node}
                  onSelectQuestoes={handleSelectQuestoes}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-text-secondary mb-4">
                Ainda não há dados de incidência calculados.
              </p>
              <p className="text-sm text-text-secondary">
                As questões precisam ser classificadas pelo sistema de IA para gerar a análise hierárquica.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Alertas e Insights */}
      {totalAnuladas > 0 && (
        <Card className="border-semantic-warning border-opacity-50">
          <CardHeader title="⚠️ Alertas" />
          <CardBody>
            <div className="p-3 bg-semantic-warning bg-opacity-10 rounded">
              <p className="text-sm text-semantic-warning">
                {totalAnuladas} questão(ões) anulada(s) detectada(s) neste edital.
                Estas questões não devem ser consideradas no seu estudo.
              </p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
