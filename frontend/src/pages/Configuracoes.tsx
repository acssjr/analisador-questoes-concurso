import { Settings, Bell, Shield, Palette, Database } from 'lucide-react';

export default function Configurações() {
  const sections = [
    {
      icon: Bell,
      title: 'Notificações',
      description: 'Configure como e quando receber alertas',
    },
    {
      icon: Palette,
      title: 'Aparência',
      description: 'Personalize o tema e cores da interface',
    },
    {
      icon: Database,
      title: 'Dados',
      description: 'Gerencie exportação e backup de dados',
    },
    {
      icon: Shield,
      title: 'Privacidade',
      description: 'Controle suas preferências de privacidade',
    },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold text-gray-900">Configurações</h1>
        <p className="text-[14px] text-gray-500 mt-1">
          Personalize sua experiência no Analisador
        </p>
      </div>

      {/* Settings sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                <section.icon size={24} className="text-gray-400 group-hover:text-[var(--accent-green)] transition-colors" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-medium text-gray-900 group-hover:text-[var(--accent-green)] transition-colors">
                  {section.title}
                </h3>
                <p className="text-[13px] text-gray-500">{section.description}</p>
              </div>
              <Settings size={18} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder notice */}
      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-[13px] text-amber-800">
          As configuracoes estarão disponíveis em uma versão futura.
        </p>
      </div>
    </div>
  );
}
