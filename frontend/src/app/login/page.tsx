'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import api from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) return;
      try {
        const token = await fbUser.getIdToken();
        await api.post('/auth/sync-user', { id_token: token });
      } catch { /* continua mesmo se API falhar */ }
      router.replace('/dashboard');
    });
    return unsub;
  }, [router]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading('email');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError('Email ou senha inválidos.');
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading('google');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError('Erro ao entrar com Google.');
      }
      setLoading(null);
    }
  };

  if (!mounted) return null;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: linear-gradient(135deg, #FF6B2B 0%, #C94A15 100%) !important; }
        .login-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #FF6B2B 0%, #C94A15 100%);
        }
        .login-card {
          background: #fff;
          border-radius: 20px;
          padding: 40px 36px 36px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.25);
        }
        .logo-area { text-align: center; margin-bottom: 32px; }
        .logo-emoji { font-size: 52px; line-height: 1; display: block; margin-bottom: 14px; }
        .logo-title { font-size: 28px; font-weight: 800; letter-spacing: -0.6px; color: #0F1117; }
        .logo-title span { color: #FF6B2B; }
        .logo-sub { font-size: 14px; color: #6B7280; margin-top: 8px; }
        .error-box {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 20px;
          color: #DC2626;
          font-size: 13px;
          font-weight: 500;
        }
        .field { margin-bottom: 14px; }
        .field label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
        .field input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1.5px solid #E5E7EB;
          font-size: 14px;
          color: #111;
          background: #FAFAFA;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        .field input:focus { border-color: #FF6B2B; background: #fff; }
        .btn-primary {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: none;
          background: #FF6B2B;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: inherit;
          transition: background 0.15s, opacity 0.15s;
        }
        .btn-primary:hover { background: #E85520; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 22px 0;
        }
        .divider hr { flex: 1; border: none; border-top: 1px solid #E5E7EB; }
        .divider span { font-size: 12px; color: #9CA3AF; font-weight: 500; }
        .btn-google {
          width: 100%;
          padding: 13px 14px;
          border-radius: 12px;
          border: 1.5px solid #E5E7EB;
          background: #FAFAFA;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          font-family: inherit;
          transition: border-color 0.15s, background 0.15s;
        }
        .btn-google:hover { border-color: #FF6B2B; background: #FFF7F4; }
        .btn-google:disabled { opacity: 0.6; cursor: not-allowed; }
        .footer-note { text-align: center; font-size: 11px; color: #9CA3AF; margin-top: 24px; line-height: 1.5; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 16px; height: 16px; flex-shrink: 0;
          border: 2.5px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        .spinner-orange {
          border-color: rgba(255,107,43,0.3);
          border-top-color: #FF6B2B;
        }
      `}</style>

      <div className="login-wrap">
        <div className="login-card">
          <div className="logo-area">
            <span className="logo-emoji">🚨</span>
            <h1 className="logo-title">Alerta<span>Cidadão</span></h1>
            <p className="logo-sub">Painel de Gestão Municipal</p>
          </div>

          {error && <div className="error-box">⚠️ {error}</div>}

          <form onSubmit={handleEmail}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={loading !== null}
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label>Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading !== null}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading !== null}>
              {loading === 'email' ? <><div className="spinner" /> Entrando...</> : 'Entrar'}
            </button>
          </form>

          <div className="divider">
            <hr /><span>ou</span><hr />
          </div>

          <button
            type="button"
            className="btn-google"
            onClick={handleGoogle}
            disabled={loading !== null}
          >
            {loading === 'google' ? (
              <><div className="spinner spinner-orange" /> Aguardando Google...</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" style={{flexShrink:0}}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Entrar com Google
              </>
            )}
          </button>

          <p className="footer-note">Acesso exclusivo para usuários autorizados pelo município</p>
        </div>
      </div>
    </>
  );
}
