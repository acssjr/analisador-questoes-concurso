import { createBrowserRouter, RouterProvider } from 'react-router';
import { Suspense } from 'react';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function AppRouter() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    }>
      <RouterProvider router={router} />
    </Suspense>
  );
}
