import { IconFolder } from '../components/ui/Icons';

export default function Projetos() {
  return (
    <div className="min-h-full flex flex-col">
      <div className="flex-1 max-w-6xl mx-auto w-full py-8 px-6">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[rgba(27,67,50,0.08)] flex items-center justify-center">
              <IconFolder size={20} className="text-[var(--accent-green)]" />
            </div>
            <h1 className="text-[28px] font-semibold text-[var(--text-primary)]">
              Projetos
            </h1>
          </div>
          <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed">
            Gerencie todos os seus projetos de análise de questões de concurso.
          </p>
        </div>

        {/* Main Content */}
        <div className="card p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-5">
            <IconFolder size={32} className="text-[var(--text-muted)]" />
          </div>
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] mb-2">
            Página de Projetos
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] max-w-md mx-auto">
            Esta página está em construção. Em breve você poderá visualizar e
            gerenciar todos os seus projetos aqui.
          </p>
        </div>
      </div>
    </div>
  );
}
