import { User, Mail, Calendar, BarChart3 } from 'lucide-react';

export default function Perfil() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold text-gray-900">Perfil</h1>
        <p className="text-[14px] text-gray-500 mt-1">
          Gerencie suas informações pessoais
        </p>
      </div>

      {/* Profile card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--accent-green)] to-emerald-400 flex items-center justify-center text-white text-[28px] font-semibold">
            U
          </div>
          <div>
            <h2 className="text-[20px] font-semibold text-gray-900">Usuario</h2>
            <p className="text-[14px] text-gray-500">usuario@email.com</p>
            <button className="mt-2 text-[13px] text-[var(--accent-green)] hover:underline">
              Editar perfil
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 size={20} className="text-[var(--accent-green)]" />
            <span className="text-[13px] text-gray-500">Projetos</span>
          </div>
          <p className="text-[28px] font-semibold text-gray-900">0</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Calendar size={20} className="text-[var(--accent-green)]" />
            <span className="text-[13px] text-gray-500">Membro desde</span>
          </div>
          <p className="text-[16px] font-medium text-gray-900">Jan 2026</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Mail size={20} className="text-[var(--accent-green)]" />
            <span className="text-[13px] text-gray-500">Status</span>
          </div>
          <p className="text-[16px] font-medium text-[var(--status-success)]">Ativo</p>
        </div>
      </div>

      {/* Account info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-[16px] font-semibold text-gray-900 mb-4">
          Informacoes da Conta
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <User size={18} className="text-gray-400" />
              <span className="text-[14px] text-gray-600">Nome</span>
            </div>
            <span className="text-[14px] text-gray-900">Usuario</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-gray-400" />
              <span className="text-[14px] text-gray-600">Email</span>
            </div>
            <span className="text-[14px] text-gray-900">usuario@email.com</span>
          </div>
        </div>
      </div>

      {/* Placeholder notice */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-[13px] text-amber-800">
          A edição de perfil estará disponível em uma versão futura.
        </p>
      </div>
    </div>
  );
}
