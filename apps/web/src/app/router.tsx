import { createBrowserRouter } from 'react-router-dom';
import { DashboardPage } from '../domain/analytics-insights/DashboardPage';

export const router = createBrowserRouter([
  { path: '/', element: <DashboardPage /> },
]);
