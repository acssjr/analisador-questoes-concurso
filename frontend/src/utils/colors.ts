// Mapa de cores por disciplina (seguindo o design)
export const DISCIPLINA_COLORS: { [key: string]: string } = {
  'Português': '#3b82f6',
  'Língua Portuguesa': '#3b82f6',
  'Matemática': '#f59e0b',
  'Direito Constitucional': '#8b5cf6',
  'Direito Administrativo': '#ec4899',
  'Informática': '#06b6d4',
  'Raciocínio Lógico': '#10b981',
  'Inglês': '#f97316',
  'Atualidades': '#eab308',
  'Geografia': '#14b8a6',
  'História': '#a855f7',
  'Física': '#0ea5e9',
  'Química': '#84cc16',
};

const DEFAULT_COLOR = '#8b949e';

export function getDisciplinaColor(disciplina: string): string {
  return DISCIPLINA_COLORS[disciplina] || DEFAULT_COLOR;
}

export function getDisciplinaColorWithAlpha(disciplina: string, alpha: number = 0.2): string {
  const color = getDisciplinaColor(disciplina);
  // Converte hex para rgba
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
