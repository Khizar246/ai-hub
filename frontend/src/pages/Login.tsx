// Access-code login gate — shown only when the backend reports auth_required.

import { useState } from 'react';
import { Lock } from 'lucide-react';
import api from '../lib/api';

const AUTH_TOKEN_KEY = 'ai_hub_auth_token';

interface LoginProps {
  onSuccess: () => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/login', { access_code: code });
      localStorage.setItem(AUTH_TOKEN_KEY, res.data.token);
      onSuccess();
    } catch {
      setError('Invalid access code. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm p-8 rounded-[10px] border border-[#1e1e1e] bg-[#111111]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-[8px] bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
            <Lock size={16} className="text-amber-400" />
          </div>
          <h1 className="text-[18px] font-semibold text-[#fafafa]">AI Hub</h1>
        </div>
        <p className="text-[13px] text-[#525252] mb-6">
          Enter your access code to continue.
        </p>

        <input
          type="password"
          autoFocus
          className="w-full p-3 rounded-[6px] text-[14px] outline-none font-medium transition-all bg-[#0f0f0f] text-[#fafafa] border border-[#262626] focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 placeholder-[#525252]"
          placeholder="Access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        {error && (
          <p className="mt-3 text-[13px] text-red-400 font-medium">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={loading || !code.trim()}
          className="mt-5 w-full h-10 bg-amber-400 hover:bg-amber-300 text-[#0a0a0a] font-semibold rounded-[6px] text-[14px] transition-all disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}
