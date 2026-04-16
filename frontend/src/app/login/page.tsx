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
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState<'email' | 'google' | null>(null);
  const [error, setError]       = useState('');

  // ── Correção do redirect: escuta Firebase Auth, sincroniza e redireciona ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) return;
      try {
        const token = await fbUser.getIdToken();
        await api.post('/auth/sync-user', { id_token: token });
      } catch {
        // Se API falhar, deixa passar — o dashboard vai lidar
      } finally {
        router.replace('/dashboard');
      }
    });
    return unsub;
  }, [router]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading('email');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged cuida do redirect
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
      // onAuthStateChanged cuida do redirect
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError('Erro ao entrar com Google. Tente novamente.');
      }
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FF6B2B 0%, #C94A15 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "-apple-system, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        padding: '40px 36px 36px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.22)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '52px', lineHeight: 1, marginBottom: '14px' }}>🚨</div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.6px', color: '#0F1117' }}>
            Alerta<span style={{ color: '#FF6B2B' }}>Cidadão</span>
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#6B7280', fontWeight: 400 }}>
            Painel de Gestão Municipal
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '20px',
            color: '#DC2626',
            fontSize: '13px',
            fontWeight: 500,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1.5px solid #E5E7EB',
                fontSize: '14px',
                color: '#111',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#FAFAFA',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#FF6B2B')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1.5px solid #E5E7EB',
                fontSize: '14px',
                color: '#111',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#FAFAFA',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#FF6B2B')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: isLoading && loading === 'email' ? '#FDA07A' : '#FF6B2B',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.15s',
            }}
          >
            {loading === 'email' ? <><Spin /> Entrando...</> : 'Entrar'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '22px 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
          <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>ou</span>
          <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '13px 14px',
            borderRadius: '12px',
            border: '1.5px solid #E5E7EB',
            background: '#FAFAFA',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: 600,
            color: '#374151',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#FF6B2B';
              (e.currentTarget as HTMLButtonElement).style.background = '#FFF7F4';
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E7EB';
            (e.currentTarget as HTMLButtonElement).style.background = '#FAFAFA';
          }}
        >
          {loading === 'google' ? (
            <><Spin color="#FF6B2B" /> Aguardando Google...</>
          ) : (
            <><GoogleSVG /> Entrar com Google</>
          )}
        </button>

        <p style={{ textAlign: 'center', fontSize: '11px', color: '#9CA3AF', marginTop: '24px', marginBottom: 0, lineHeight: 1.5 }}>
          Acesso exclusivo para usuários autorizados pelo município
        </p>
      </div>
    </div>
  );
}

function Spin({ color = '#fff' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin .75s linear infinite', flexShrink: 0 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="22 16" strokeLinecap="round" />
    </svg>
  );
}

function GoogleSVG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
