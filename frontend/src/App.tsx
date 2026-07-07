// React Router root: "/" → Dashboard, "/agent/:agentId" → AgentPage.
// If the backend has an access code configured, the whole app sits behind Login.

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Shell from './components/layout/Shell';
import Dashboard from './pages/Dashboard';
import AgentPage from './pages/AgentPage';
import Login from './pages/Login';
import api from './lib/api';

const AUTH_TOKEN_KEY = 'ai_hub_auth_token';

export default function App() {
  // null = auth status unknown (still loading)
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(
    () => !!localStorage.getItem(AUTH_TOKEN_KEY)
  );

  useEffect(() => {
    api
      .get('/auth/status')
      .then((res) => setAuthRequired(!!res.data.auth_required))
      // If the status check fails, don't lock the user out of the UI —
      // API calls will still 401 if the backend actually requires auth.
      .catch(() => setAuthRequired(false));
  }, []);

  if (authRequired === null) {
    return <div className="min-h-screen bg-[#0a0a0a]" />;
  }

  if (authRequired && !hasToken) {
    return <Login onSuccess={() => setHasToken(true)} />;
  }

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
