import { groupBy, orderBy } from 'lodash';
import type { Questao } from '../types';

export interface DistribuicaoItem {
  categoria: string;
  count: number;
  percentual: number;
}

export function calcularDistribuicao(
  questoes: Questao[],
  campo: keyof Questao
): DistribuicaoItem[] {
  const grupos = groupBy(questoes, campo);
  const total = questoes.length;

  const distribuicao = Object.entries(grupos).map(([categoria, items]) => ({
    categoria,
    count: items.length,
    percentual: (items.length / total) * 100,
  }));

  return orderBy(distribuicao, 'count', 'desc');
}

export function agruparPorHierarquia(
  questoes: Questao[],
  _nivel: 'assunto' | 'topico' | 'subtopico' = 'assunto'
): DistribuicaoItem[] {
  // Placeholder - em produção seria baseado na classificação completa
  return calcularDistribuicao(questoes, 'assunto_pci');
}

export function filtrarQuestoes(
  questoes: Questao[],
  filtros: {
    status?: 'todas' | 'regulares' | 'anuladas';
    anos?: number[];
    bancas?: string[];
    disciplina?: string;
  }
): Questao[] {
  let resultado = questoes;

  if (filtros.status === 'regulares') {
    resultado = resultado.filter(q => !q.anulada);
  } else if (filtros.status === 'anuladas') {
    resultado = resultado.filter(q => q.anulada);
  }

  if (filtros.anos && filtros.anos.length > 0) {
    resultado = resultado.filter(q => filtros.anos!.includes(q.ano));
  }

  if (filtros.bancas && filtros.bancas.length > 0) {
    resultado = resultado.filter(q => filtros.bancas!.includes(q.banca));
  }

  if (filtros.disciplina) {
    resultado = resultado.filter(q => q.disciplina === filtros.disciplina);
  }

  return resultado;
}

export function extrairDisciplinas(questoes: Questao[]): string[] {
  const disciplinas = new Set(questoes.map(q => q.disciplina));
  return Array.from(disciplinas).sort();
}

export function extrairAnos(questoes: Questao[]): number[] {
  const anos = new Set(questoes.map(q => q.ano));
  return Array.from(anos).sort((a, b) => b - a);
}

export function extrairBancas(questoes: Questao[]): string[] {
  const bancas = new Set(questoes.map(q => q.banca));
  return Array.from(bancas).sort();
}
