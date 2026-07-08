import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Shell from './components/layout/Shell';
import Dashboard from './pages/Dashboard';
import AgentPage from './pages/AgentPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Shell>
              <Dashboard />
            </Shell>
          }
        />
        <Route
          path="/agent/:agentId"
          element={
            <Shell>
              <AgentPage />
            </Shell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
