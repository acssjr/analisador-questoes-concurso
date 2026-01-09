import { useState } from 'react';
import { groupBy } from 'lodash';
import { useAppStore } from '../store/appStore';
import { Card, CardHeader, CardBody, Badge, Button } from '../components/ui';
import { filtrarQuestoes } from '../utils/calculations';
import { getDisciplinaColor } from '../utils/colors';
import { TreemapChart } from '../components/charts/TreemapChart';
import { TimelineChart } from '../components/charts/TimelineChart';
import type { TabLaboratorio } from '../types';

export function Laboratory() {
  const questoes = useAppStore(state => state.questoes);
  const activeDisciplina = useAppStore(state => state.activeDisciplina);
  const filtros = useAppStore(state => state.filtros);
  const tabLaboratorio = useAppStore(state => state.tabLaboratorio);
  const setTabLaboratorio = useAppStore(state => state.setTabLaboratorio);
  const setModoCanvas = useAppStore(state => state.setModoCanvas);
  const setPainelDireito = useAppStore(state => state.setPainelDireito);

  const [searchTerm, setSearchTerm] = useState('');

  const questoesFiltradas = filtrarQuestoes(questoes, { ...filtros, disciplina: activeDisciplina || undefined })
    .filter(q => {
      if (!searchTerm) return true;
      return q.enunciado.toLowerCase().includes(searchTerm.toLowerCase()) ||
             q.numero.toString().includes(searchTerm);
    });

  // Preparar dados para Treemap
  const treemapData = Object.entries(groupBy(questoesFiltradas, 'assunto_pci')).map(([assunto, items]) => ({
    name: assunto || 'Sem assunto',
    size: items.length,
  }));

  // Preparar dados para Timeline
  const timelineData = Object.entries(groupBy(questoesFiltradas, 'ano'))
    .map(([ano, items]) => {
      const byAssunto = groupBy(items, 'assunto_pci');
      return {
        ano: parseInt(ano),
        ...Object.fromEntries(
          Object.entries(byAssunto).map(([assunto, assuntoItems]) => [
            assunto || 'Sem assunto',
            assuntoItems.length
          ])
        ),
      };
    })
    .sort((a, b) => a.ano - b.ano);

  const assuntosUnicos = Array.from(new Set(questoesFiltradas.map(q => q.assunto_pci || 'Sem assunto')));

  if (!activeDisciplina) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-secondary">Selecione uma disciplina na barra lateral</p>
      </div>
    );
  }

  const tabs: { id: TabLaboratorio; label: string; icon: string }[] = [
    { id: 'distribuicao', label: 'Distribuição', icon: '📊' },
    { id: 'similaridade', label: 'Similaridade', icon: '🔗' },
    { id: 'temporal', label: 'Temporal', icon: '📅' },
    { id: 'questoes', label: 'Questões', icon: '📝' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Laboratório - {activeDisciplina}</h1>
          <p className="text-sm text-text-secondary">Exploração avançada com controle total</p>
        </div>
        <Button variant="ghost" onClick={() => setModoCanvas('insights')}>
          ← Voltar para Insights
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-dark-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTabLaboratorio(tab.id)}
            className={`
              px-4 py-2 text-sm font-medium transition-colors relative
              ${tabLaboratorio === tab.id
                ? 'text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
              }
            `}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
            {tabLaboratorio === tab.id && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: getDisciplinaColor(activeDisciplina) }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo da Tab */}
      <div className="mt-6">
        {tabLaboratorio === 'distribuicao' && (
          <Card>
            <CardHeader
              title="Treemap Hierárquico"
              subtitle="Visualização da distribuição de questões por assunto"
            />
            <CardBody>
              <TreemapChart data={treemapData} disciplina={activeDisciplina} />
              <div className="mt-6 grid grid-cols-3 gap-4">
                {treemapData.slice(0, 6).map(item => (
                  <div key={item.name} className="surface p-3">
                    <p className="text-sm font-medium text-text-primary mb-1">{item.name}</p>
                    <p className="text-xs text-text-secondary">{item.size} questões</p>
                    <div className="mt-2 h-2 bg-dark-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(item.size / questoesFiltradas.length) * 100}%`,
                          backgroundColor: getDisciplinaColor(activeDisciplina),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {tabLaboratorio === 'temporal' && (
          <Card>
            <CardHeader
              title="Linha do Tempo"
              subtitle="Evolução da distribuição de questões ao longo dos anos"
            />
            <CardBody>
              <TimelineChart
                data={timelineData}
                assuntos={assuntosUnicos}
                disciplina={activeDisciplina}
              />
              <div className="mt-6">
                <h4 className="text-sm font-medium text-text-secondary mb-3">Estatísticas Temporais</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div className="surface p-3">
                    <p className="text-xs text-text-secondary mb-1">Anos Cobertos</p>
                    <p className="text-xl font-bold text-text-primary font-mono">
                      {timelineData.length}
                    </p>
                  </div>
                  <div className="surface p-3">
                    <p className="text-xs text-text-secondary mb-1">Ano com Mais Questões</p>
                    <p className="text-xl font-bold text-text-primary font-mono">
                      {timelineData.reduce<{ ano: number; total: number }>((max, curr) => {
                        const total = Object.values(curr).filter(v => typeof v === 'number').reduce((a: number, b) => a + (b as number), 0) as number;
                        return total > max.total ? { ano: curr.ano, total } : max;
                      }, { ano: 0, total: 0 }).ano}
                    </p>
                  </div>
                  <div className="surface p-3">
                    <p className="text-xs text-text-secondary mb-1">Média por Ano</p>
                    <p className="text-xl font-bold text-text-primary font-mono">
                      {(questoesFiltradas.length / timelineData.length).toFixed(1)}
                    </p>
                  </div>
                  <div className="surface p-3">
                    <p className="text-xs text-text-secondary mb-1">Assuntos Diferentes</p>
                    <p className="text-xl font-bold text-text-primary font-mono">
                      {assuntosUnicos.length}
                    </p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {tabLaboratorio === 'similaridade' && (
          <Card>
            <CardHeader
              title="Clusters de Similaridade"
              subtitle="Grupos de questões similares detectados automaticamente"
            />
            <CardBody>
              <div className="text-center py-12">
                <p className="text-text-secondary text-sm mb-4">
                  Análise de similaridade requer processamento via backend
                </p>
                <p className="text-text-secondary text-xs">
                  Conecte-se à API para visualizar questões similares
                </p>
              </div>
            </CardBody>
          </Card>
        )}

        {tabLaboratorio === 'questoes' && (
          <Card>
            <CardHeader
              title="Tabela de Questões"
              subtitle={`${questoesFiltradas.length} questões encontradas`}
              action={
                <input
                  type="text"
                  placeholder="Buscar no enunciado ou número..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-1.5 bg-dark-surface border border-dark-border rounded text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-disciplinas-portugues"
                />
              }
            />
            <CardBody noPadding>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-dark-surface border-b border-dark-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">Ano</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">Banca</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">Cargo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">Assunto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">Enunciado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border">
                    {questoesFiltradas.slice(0, 50).map(questao => (
                      <tr
                        key={questao.id}
                        className="hover:bg-white hover:bg-opacity-5 transition-colors cursor-pointer"
                        onClick={() => setPainelDireito(true, questao)}
                      >
                        <td className="px-4 py-3 font-mono text-text-secondary">
                          {questao.numero}
                        </td>
                        <td className="px-4 py-3 text-text-primary">{questao.ano}</td>
                        <td className="px-4 py-3 text-text-primary">{questao.banca}</td>
                        <td className="px-4 py-3 text-text-secondary">{questao.cargo}</td>
                        <td className="px-4 py-3 text-text-primary">{questao.assunto_pci}</td>
                        <td className="px-4 py-3">
                          {questao.anulada ? (
                            <Badge variant="warning">Anulada</Badge>
                          ) : (
                            <Badge variant="success">Regular</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-text-primary max-w-md">
                          <p className="line-clamp-2">{questao.enunciado}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="sm">
                            Ver →
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {questoesFiltradas.length > 50 && (
                <div className="p-4 border-t border-dark-border text-center">
                  <p className="text-xs text-text-secondary">
                    Mostrando 50 de {questoesFiltradas.length} questões
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
