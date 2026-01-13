import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from './router';
import { NotificationCenter } from './components/features/NotificationCenter';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
    <NotificationCenter />
  </StrictMode>
);
