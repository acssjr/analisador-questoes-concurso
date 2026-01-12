import { MainLayout } from './components/layout/MainLayout';
import { Insights } from './pages/Insights';
import { Laboratory } from './pages/Laboratory';
import { EditalAnalysis } from './pages/EditalAnalysis';
import { NotificationCenter } from './components/features/NotificationCenter';
import { useAppStore } from './store/appStore';

function App() {
  const modoCanvas = useAppStore(state => state.modoCanvas);
  const activeEdital = useAppStore(state => state.activeEdital);

  // Se há um edital ativo, mostra a página de análise do edital
  if (activeEdital) {
    return (
      <>
        <MainLayout>
          {modoCanvas === 'insights' ? <EditalAnalysis /> : <Laboratory />}
        </MainLayout>
        <NotificationCenter />
      </>
    );
  }

  // Sem edital ativo, mostra tela inicial pedindo upload
  return (
    <>
      <MainLayout>
        <Insights />
      </MainLayout>
      <NotificationCenter />
    </>
  );
}

export default App;
