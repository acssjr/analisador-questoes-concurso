import { lazy } from 'react';

// Lazy load pages for code splitting
const Home = lazy(() => import('../pages/Home').then(m => ({ default: m.Home })));
const ProjetoLayout = lazy(() => import('../pages/projeto/ProjetoLayout'));
const VisaoGeral = lazy(() => import('../pages/projeto/VisaoGeral'));
const ProvasQuestoes = lazy(() => import('../pages/projeto/ProvasQuestoes'));
const AnaliseProfunda = lazy(() => import('../pages/projeto/AnaliseProfunda'));

export const routes = [
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/projeto/:id',
    element: <ProjetoLayout />,
    children: [
      {
        index: true,
        element: <VisaoGeral />,
      },
      {
        path: 'visao-geral',
        element: <VisaoGeral />,
      },
      {
        path: 'provas',
        element: <ProvasQuestoes />,
      },
      {
        path: 'analise',
        element: <AnaliseProfunda />,
      },
    ],
  },
];
