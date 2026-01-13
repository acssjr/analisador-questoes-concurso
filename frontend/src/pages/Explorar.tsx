import { useState } from 'react';
import { motion } from 'framer-motion';
import { groupBy } from 'lodash';
import { useAppStore } from '../store/appStore';
import { filtrarQuestoes } from '../utils/calculations';
import { getDisciplinaColor } from '../utils/colors';
import { TreemapChart } from '../components/charts/TreemapChart';
import { TimelineChart } from '../components/charts/TimelineChart';
import type { TabLaboratorio } from '../types';
import {
  IconChart,
  IconCalendar,
  IconLink,
  IconFileText,
  IconArrowLeft,
  IconSearch,
  IconCheck,
  IconX,
  IconArrowRight,
  IconTarget,
} from '../components/ui/Icons';

// Tab component
function Tab({
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-all duration-200
        ${isActive
          ? 'text-[var(--accent-green)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }
      `}
    >
      <Icon size={16} />
      {label}
      {isActive && (
        <motion.div
          layoutId="activeExplorarTab"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-green)] rounded-full"
        />
      )}
    </button>
  );
}

// Stat mini card
function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-[20px] font-semibold text-[var(--text-primary)] text-mono">
        {value}
      </div>
    </div>
  );
}

// Question row
function QuestionRow({
  numero,
  ano,
  banca,
  cargo,
  assunto,
  enunciado,
  anulada,
  onClick,
  accentColor,
}: {
  numero: number;
  ano: number;
  banca: string;
  cargo: string;
  assunto: string;
  enunciado: string;
  anulada: boolean;
  onClick: () => void;
  accentColor: string;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClick}
      className="cursor-pointer border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] transition-colors"
    >
      <td className="px-4 py-3 text-mono text-[var(--text-muted)] text-[13px]">{numero}</td>
      <td className="px-4 py-3 text-[var(--text-primary)] text-[13px]">{ano}</td>
      <td className="px-4 py-3 text-[var(--text-primary)] text-[13px]">{banca}</td>
      <td className="px-4 py-3 text-[var(--text-secondary)] text-[13px]">{cargo}</td>
      <td className="px-4 py-3 text-[13px]">
        <span
          className="px-2 py-1 rounded-md text-[11px] font-medium"
          style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
        >
          {assunto}
        </span>
      </td>
      <td className="px-4 py-3 text-[13px]">
        {anulada ? (
          <span className="badge badge-amber text-[11px]">
            <IconX size={10} />
            Anulada
          </span>
        ) : (
          <span className="badge badge-green text-[11px]">
            <IconCheck size={10} />
            Regular
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--text-secondary)] text-[13px] max-w-md">
        <p className="line-clamp-2">{enunciado}</p>
      </td>
      <td className="px-4 py-3">
        <span className="text-[var(--text-muted)] hover:text-[var(--accent-green)] text-[13px] flex items-center gap-1">
          Ver <IconArrowRight size={12} />
        </span>
      </td>
    </motion.tr>
  );
}

// Distribution card
function DistributionCard({
  name,
  count,
  percentage,
  accentColor,
}: {
  name: string;
  count: number;
  percentage: number;
  accentColor: string;
}) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
          {name}
        </span>
        <span className="text-[11px] text-[var(--text-tertiary)]">{count} questões</span>
      </div>
      <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
          className="h-full rounded-full"
          style={{ backgroundColor: accentColor }}
        />
      </div>
      <div className="text-[11px] text-[var(--text-muted)] mt-2 text-mono">
        {percentage.toFixed(1)}%
      </div>
    </div>
  );
}

export function Explorar() {
  const questoes = useAppStore((state) => state.questoes);
  const activeDisciplina = useAppStore((state) => state.activeDisciplina);
  const filtros = useAppStore((state) => state.filtros);
  const tabLaboratorio = useAppStore((state) => state.tabLaboratorio);
  const setTabLaboratorio = useAppStore((state) => state.setTabLaboratorio);
  const setModoCanvas = useAppStore((state) => state.setModoCanvas);
  const setPainelDireito = useAppStore((state) => state.setPainelDireito);

  const [searchTerm, setSearchTerm] = useState('');

  const accentColor = activeDisciplina ? getDisciplinaColor(activeDisciplina) : 'var(--accent-green)';

  const questoesFiltradas = filtrarQuestoes(questoes, {
    ...filtros,
    disciplina: activeDisciplina || undefined,
  }).filter((q) => {
    if (!searchTerm) return true;
    return (
      q.enunciado.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.numero.toString().includes(searchTerm)
    );
  });

  // Treemap data
  const treemapData = Object.entries(groupBy(questoesFiltradas, 'assunto_pci')).map(
    ([assunto, items]) => ({
      name: assunto || 'Sem assunto',
      size: items.length,
    })
  );

  // Timeline data
  const timelineData = Object.entries(groupBy(questoesFiltradas, 'ano'))
    .map(([ano, items]) => {
      const byAssunto = groupBy(items, 'assunto_pci');
      return {
        ano: parseInt(ano),
        ...Object.fromEntries(
          Object.entries(byAssunto).map(([assunto, assuntoItems]) => [
            assunto || 'Sem assunto',
            assuntoItems.length,
          ])
        ),
      };
    })
    .sort((a, b) => a.ano - b.ano);

  const assuntosUnicos = Array.from(
    new Set(questoesFiltradas.map((q) => q.assunto_pci || 'Sem assunto'))
  );

  if (!activeDisciplina) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mb-4">
          <IconTarget size={32} className="text-[var(--text-muted)]" />
        </div>
        <p className="text-[var(--text-tertiary)] text-[15px]">
          Selecione uma disciplina na barra lateral
        </p>
      </div>
    );
  }

  const tabs: { id: TabLaboratorio; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'distribuicao', label: 'Distribuição', icon: IconChart },
    { id: 'temporal', label: 'Temporal', icon: IconCalendar },
    { id: 'similaridade', label: 'Similaridade', icon: IconLink },
    { id: 'questoes', label: 'Questões', icon: IconFileText },
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1
            className="text-[24px] font-semibold text-[var(--text-primary)] mb-1"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Explorar — {activeDisciplina}
          </h1>
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Análise avançada com controle total
          </p>
        </div>
        <button
          onClick={() => setModoCanvas('insights')}
          className="btn btn-secondary btn-sm"
        >
          <IconArrowLeft size={16} />
          Voltar para Dashboard
        </button>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            isActive={tabLaboratorio === tab.id}
            onClick={() => setTabLaboratorio(tab.id)}
          />
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        {/* Distribution Tab */}
        {tabLaboratorio === 'distribuicao' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="card p-6">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-4">
                Treemap Hierárquico
              </h2>
              <TreemapChart data={treemapData} disciplina={activeDisciplina} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {treemapData.slice(0, 6).map((item) => (
                <DistributionCard
                  key={item.name}
                  name={item.name}
                  count={item.size}
                  percentage={(item.size / questoesFiltradas.length) * 100}
                  accentColor={accentColor}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Temporal Tab */}
        {tabLaboratorio === 'temporal' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="card p-6">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-4">
                Linha do Tempo
              </h2>
              <TimelineChart
                data={timelineData}
                assuntos={assuntosUnicos}
                disciplina={activeDisciplina}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MiniStat label="Anos Cobertos" value={timelineData.length} />
              <MiniStat
                label="Ano com Mais Questões"
                value={
                  timelineData.reduce<{ ano: number; total: number }>(
                    (max, curr) => {
                      const values = Object.values(curr).filter(
                        (v): v is number => typeof v === 'number' && v !== curr.ano
                      );
                      const total = values.reduce((a, b) => a + b, 0);
                      return total > max.total ? { ano: curr.ano, total } : max;
                    },
                    { ano: 0, total: 0 }
                  ).ano || '-'
                }
              />
              <MiniStat
                label="Média por Ano"
                value={
                  timelineData.length > 0
                    ? (questoesFiltradas.length / timelineData.length).toFixed(1)
                    : '-'
                }
              />
              <MiniStat label="Assuntos Diferentes" value={assuntosUnicos.length} />
            </div>
          </motion.div>
        )}

        {/* Similarity Tab */}
        {tabLaboratorio === 'similaridade' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6"
          >
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-4">
              Clusters de Similaridade
            </h2>
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-4">
                <IconLink size={28} className="text-[var(--text-muted)]" />
              </div>
              <p className="text-[var(--text-tertiary)] mb-1">
                Análise de similaridade em desenvolvimento
              </p>
              <p className="text-[12px] text-[var(--text-muted)]">
                Em breve: detectar questões similares automaticamente
              </p>
            </div>
          </motion.div>
        )}

        {/* Questions Tab */}
        {tabLaboratorio === 'questoes' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card overflow-hidden"
          >
            <div className="p-6 border-b border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                    Tabela de Questões
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)]">
                    {questoesFiltradas.length} questões encontradas
                  </p>
                </div>
                <div className="relative">
                  <IconSearch
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <input
                    type="text"
                    placeholder="Buscar no enunciado ou número..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input input-search pl-9 w-72"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                      Ano
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                      Banca
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                      Cargo
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                      Assunto
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                      Enunciado
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {questoesFiltradas.slice(0, 50).map((questao) => (
                    <QuestionRow
                      key={questao.id}
                      numero={questao.numero}
                      ano={questao.ano}
                      banca={questao.banca}
                      cargo={questao.cargo}
                      assunto={questao.assunto_pci || 'Sem assunto'}
                      enunciado={questao.enunciado}
                      anulada={questao.anulada}
                      onClick={() => setPainelDireito(true, questao)}
                      accentColor={accentColor}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {questoesFiltradas.length > 50 && (
              <div className="p-4 border-t border-[var(--border-subtle)] text-center bg-[var(--bg-subtle)]">
                <p className="text-[12px] text-[var(--text-tertiary)]">
                  Mostrando 50 de {questoesFiltradas.length} questões
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
