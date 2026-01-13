import { motion } from 'framer-motion';
import { useAppStore } from '../../store/appStore';
import { extrairDisciplinas } from '../../utils/calculations';
import { getDisciplinaColor } from '../../utils/colors';
import {
  IconDashboard,
  IconExplore,
  IconBookOpen,
  IconChart,
  IconSettings,
  IconLogout,
} from '../ui/Icons';

// Navigation item component
function NavItem({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
        ${isActive
          ? 'bg-[var(--accent-green)] text-white'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
        }
      `}
    >
      <Icon size={20} />
      <span className="text-[13px] font-medium flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`
          text-[11px] font-semibold px-1.5 py-0.5 rounded-md
          ${isActive ? 'bg-white/20 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'}
        `}>
          {badge}
        </span>
      )}
    </button>
  );
}

// Discipline item component
function DisciplinaItem({
  nome,
  count,
  color,
  isActive,
  onClick,
  index,
}: {
  nome: string;
  count: number;
  color: string;
  isActive: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200
        ${isActive
          ? 'bg-[var(--bg-subtle)]'
          : 'hover:bg-[var(--bg-subtle)]'
        }
      `}
    >
      {/* Color indicator */}
      <div
        className={`w-2 h-2 rounded-full transition-transform duration-200 ${isActive ? 'scale-125' : ''}`}
        style={{ backgroundColor: color }}
      />

      {/* Name */}
      <span className={`
        text-[13px] flex-1 text-left truncate transition-colors
        ${isActive ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}
      `}>
        {nome}
      </span>

      {/* Count badge */}
      <span
        className={`
          text-[11px] font-medium px-1.5 py-0.5 rounded-md transition-all
          ${isActive
            ? 'text-white'
            : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
          }
        `}
        style={isActive ? { backgroundColor: color } : undefined}
      >
        {count}
      </span>
    </motion.button>
  );
}

export function Sidebar() {
  const questoes = useAppStore((state) => state.questoes);
  const activeDisciplina = useAppStore((state) => state.activeDisciplina);
  const setActiveDisciplina = useAppStore((state) => state.setActiveDisciplina);
  const modoCanvas = useAppStore((state) => state.modoCanvas);
  const setModoCanvas = useAppStore((state) => state.setModoCanvas);

  const disciplinas = extrairDisciplinas(questoes);

  const contagemPorDisciplina = disciplinas.map((disciplina) => ({
    nome: disciplina,
    count: questoes.filter((q) => q.disciplina === disciplina).length,
    color: getDisciplinaColor(disciplina),
  }));

  return (
    <aside className="w-60 bg-[var(--bg-elevated)] border-r border-[var(--border-subtle)] flex-shrink-0 flex flex-col">
      {/* Main Navigation */}
      <div className="p-4">
        <p className="text-caption mb-2 px-3">Menu</p>
        <nav className="space-y-1">
          <NavItem
            icon={IconDashboard}
            label="Dashboard"
            isActive={modoCanvas === 'insights'}
            onClick={() => setModoCanvas('insights')}
          />
          <NavItem
            icon={IconExplore}
            label="Explorar"
            isActive={modoCanvas === 'laboratorio'}
            onClick={() => setModoCanvas('laboratorio')}
            badge={questoes.length}
          />
          <NavItem
            icon={IconChart}
            label="Relatórios"
          />
        </nav>
      </div>

      {/* Divider */}
      <div className="decorative-line mx-4" />

      {/* Disciplines Section */}
      <div className="flex-1 overflow-hidden flex flex-col p-4">
        <div className="flex items-center justify-between mb-2 px-3">
          <p className="text-caption">Disciplinas</p>
          <span className="text-[11px] text-[var(--text-muted)]">
            {disciplinas.length}
          </span>
        </div>

        {disciplinas.length > 0 ? (
          <div className="flex-1 overflow-y-auto scrollbar-custom space-y-0.5 pr-1">
            {contagemPorDisciplina.map(({ nome, count, color }, index) => (
              <DisciplinaItem
                key={nome}
                nome={nome}
                count={count}
                color={color}
                isActive={activeDisciplina === nome}
                onClick={() => setActiveDisciplina(nome)}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-4">
              <div className="w-10 h-10 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-3">
                <IconBookOpen size={20} className="text-[var(--text-muted)]" />
              </div>
              <p className="text-[12px] text-[var(--text-tertiary)]">
                Importe provas para ver as disciplinas
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="decorative-line mx-4" />

      {/* Bottom Actions */}
      <div className="p-4">
        <p className="text-caption mb-2 px-3">Conta</p>
        <nav className="space-y-1">
          <NavItem icon={IconSettings} label="Configurações" />
          <NavItem icon={IconLogout} label="Sair" />
        </nav>
      </div>

      {/* Stats Footer */}
      {questoes.length > 0 && (
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[20px] font-semibold text-[var(--text-primary)] text-mono">
                {questoes.length}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                questões totais
              </p>
            </div>
            <div className="text-right">
              <p className="text-[20px] font-semibold text-[var(--text-primary)] text-mono">
                {disciplinas.length}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                disciplinas
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
