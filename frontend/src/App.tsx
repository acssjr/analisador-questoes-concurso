// This file is kept for reference but main.tsx now uses AppRouter directly
import { useEffect } from 'react';
import Lenis from 'lenis';
import { MainLayout } from './components/layout/MainLayout';
import { Home } from './pages/Home';
import { NotificationCenter } from './components/features/NotificationCenter';

// Legacy App component - replaced by React Router
function App() {
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
