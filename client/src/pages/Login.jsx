import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Loader2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { formatApiError } from '../lib/formatError';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, user, requireLogin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!requireLogin || user)) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, requireLogin, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      const msg =
        err.message === 'Network Error'
          ? 'Cannot reach the server. Check that the app backend is running, then try again.'
          : formatApiError(err, 'Invalid username or password');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || (!requireLogin || user)) {
    return (
      <div className="min-h-screen flex items-center justify-center ht-login-stage">
        <Loader2 className="animate-spin text-white" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center ht-login-stage px-4 py-10">
      <div className="w-full max-w-md relative z-10 ht-animate-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/20 mb-4 border border-white/10 shadow-glow animate-[ht-float_4s_ease-in-out_infinite]">
            <MessageSquare size={32} className="text-accent" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            WhatsApp Campaign Automation
          </h1>
          <p className="text-white/60 mt-2 text-sm">Sign in to manage campaigns</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 space-y-5 border border-white/40"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="ht-input w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="ht-input w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-xl outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="ht-btn ht-btn-primary w-full py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
