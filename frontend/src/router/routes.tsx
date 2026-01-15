import { lazy } from 'react';
import { AppLayout } from '../components/layout/AppLayout';

// Lazy load pages for code splitting
const Home = lazy(() => import('../pages/Home').then(m => ({ default: m.Home })));
const Projetos = lazy(() => import('../pages/Projetos'));
const Configuracoes = lazy(() => import('../pages/Configuracoes'));
const Perfil = lazy(() => import('../pages/Perfil'));
const ProjetoLayout = lazy(() => import('../pages/projeto/ProjetoLayout'));
const VisaoGeral = lazy(() => import('../pages/projeto/VisaoGeral'));
const ProvasQuestoes = lazy(() => import('../pages/projeto/ProvasQuestoes'));
const AnaliseProfunda = lazy(() => import('../pages/projeto/AnaliseProfunda'));

export const routes = [
  {
    element: <AppLayout />,
    children: [
      {
        path: '/',
        element: <Home />,
      },
      {
        path: '/projetos',
        element: <Projetos />,
      },
      {
        path: '/configuracoes',
        element: <Configuracoes />,
      },
      {
        path: '/perfil',
        element: <Perfil />,
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
    ],
  },
];
