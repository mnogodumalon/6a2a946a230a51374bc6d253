import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import ReparaturauftraegePage from '@/pages/ReparaturauftraegePage';
import ReparaturauftraegeDetailPage from '@/pages/ReparaturauftraegeDetailPage';
import KundenverwaltungPage from '@/pages/KundenverwaltungPage';
import KundenverwaltungDetailPage from '@/pages/KundenverwaltungDetailPage';
import PublicFormReparaturauftraege from '@/pages/public/PublicForm_Reparaturauftraege';
import PublicFormKundenverwaltung from '@/pages/public/PublicForm_Kundenverwaltung';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a2a945752aca730d81808a1" element={<PublicFormReparaturauftraege />} />
              <Route path="public/6a2a94549cc8953c0fbcc8bc" element={<PublicFormKundenverwaltung />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="reparaturauftraege" element={<ReparaturauftraegePage />} />
                <Route path="reparaturauftraege/:id" element={<ReparaturauftraegeDetailPage />} />
                <Route path="kundenverwaltung" element={<KundenverwaltungPage />} />
                <Route path="kundenverwaltung/:id" element={<KundenverwaltungDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
