import { memo, useCallback } from 'react';
import { NavLink } from 'react-router';
import { Home, FolderOpen, Settings, User, BookOpen } from 'lucide-react';

interface NavItemProps {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  badge?: number;
}

// Preload map for route prefetching on hover
const preloadMap: Record<string, () => Promise<unknown>> = {
  '/': () => import('../../pages/Home'),
  '/projetos': () => import('../../pages/Projetos'),
  '/configuracoes': () => import('../../pages/Configuracoes'),
  '/perfil': () => import('../../pages/Perfil'),
};

const NavItem = memo(function NavItem({ to, icon: Icon, label, badge }: NavItemProps) {
  const handleMouseEnter = useCallback(() => {
    preloadMap[to]?.();
  }, [to]);

  return (
    <NavLink
      to={to}
      onMouseEnter={handleMouseEnter}
      className={({ isActive }) => `
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
        ${isActive
          ? 'bg-[var(--accent-green)] text-white'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }
      `}
    >
      <Icon size={20} />
      <span className="text-[13px] font-medium flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-white/20">
          {badge}
        </span>
      )}
    </NavLink>
  );
});

interface GlobalSidebarProps {
  totalProjetos?: number;
}

export const GlobalSidebar = memo(function GlobalSidebar({ totalProjetos = 0 }: GlobalSidebarProps) {
  return (
    <aside className="w-60 bg-gray-900 flex-shrink-0 flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-green)] flex items-center justify-center">
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-white tracking-tight">
              Analisador
            </h1>
            <p className="text-[11px] text-gray-500 -mt-0.5">
              Questões de Concurso
            </p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="p-4 flex-1">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-3 px-3">
          Menu
        </p>
        <nav className="space-y-1">
          <NavItem
            to="/"
            icon={Home}
            label="Dashboard"
          />
          <NavItem
            to="/projetos"
            icon={FolderOpen}
            label="Projetos"
            badge={totalProjetos}
          />
        </nav>
      </div>

      {/* Bottom Navigation */}
      <div className="p-4 border-t border-gray-800">
        <nav className="space-y-1">
          <NavItem
            to="/configuracoes"
            icon={Settings}
            label="Configurações"
          />
          <NavItem
            to="/perfil"
            icon={User}
            label="Perfil"
          />
        </nav>
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-gray-800 bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent-green)] to-emerald-400 flex items-center justify-center text-white text-[13px] font-semibold">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white truncate">
              Usuário
            </p>
            <p className="text-[11px] text-gray-500 truncate">
              usuario@email.com
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
});
