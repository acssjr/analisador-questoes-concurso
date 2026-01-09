import { useAppStore } from '../../store/appStore';
import { extrairDisciplinas } from '../../utils/calculations';
import { getDisciplinaColor } from '../../utils/colors';
import { Badge } from '../ui';

export function Sidebar() {
  const questoes = useAppStore(state => state.questoes);
  const activeDisciplina = useAppStore(state => state.activeDisciplina);
  const setActiveDisciplina = useAppStore(state => state.setActiveDisciplina);

  const disciplinas = extrairDisciplinas(questoes);

  const contagemPorDisciplina = disciplinas.map(disciplina => ({
    nome: disciplina,
    count: questoes.filter(q => q.disciplina === disciplina).length,
    color: getDisciplinaColor(disciplina),
  }));

  return (
    <aside className="w-60 surface border-r border-dark-border flex-shrink-0 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-sm font-medium text-text-secondary mb-4">
          DISCIPLINAS ({questoes.length} questões)
        </h2>

        <nav className="space-y-1">
          {contagemPorDisciplina.map(({ nome, count, color }) => {
            const isActive = activeDisciplina === nome;

            return (
              <button
                key={nome}
                onClick={() => setActiveDisciplina(nome)}
                className={`
                  w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all
                  ${isActive
                    ? 'bg-white bg-opacity-5'
                    : 'hover:bg-white hover:bg-opacity-5'
                  }
                `}
                style={{
                  borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
                }}
              >
                <span className={`text-sm ${isActive ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                  {nome}
                </span>
                <Badge variant="disciplina" disciplina={nome}>
                  {count}
                </Badge>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
