import { useEffect } from 'react';
import Lenis from 'lenis';
import { MainLayout } from './components/layout/MainLayout';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Explorar } from './pages/Explorar';
import { NotificationCenter } from './components/features/NotificationCenter';
import { useAppStore } from './store/appStore';

function App() {
  const modoCanvas = useAppStore((state) => state.modoCanvas);
  const activeEdital = useAppStore((state) => state.activeEdital);

  // Initialize Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  // If there's an active edital, show Dashboard or Explorar
  if (activeEdital) {
    return (
      <>
        <MainLayout>
          {modoCanvas === 'laboratorio' ? <Explorar /> : <Dashboard />}
        </MainLayout>
        <NotificationCenter />
      </>
    );
  }

  // No active edital - show Home page
  return (
    <>
      <MainLayout showSidebar={false}>
        <Home />
      </MainLayout>
      <NotificationCenter />
    </>
  );
}

export default App;
