'use client';
import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [tenant, setTenant]       = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
    // Pré-preencher tenant do hostname
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const sub  = host.split('.')[0];
      if (sub !== 'localhost' && sub !== 'www') setTenant(sub);
    }
  }, [status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', {
      email, password, tenant: tenant || 'demo',
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError('E-mail ou senha incorretos. Verifique suas credenciais.');
    } else {
      router.replace('/dashboard');
    }
  }

  return (
    <div className="min-h-screen bg-void flex items-center justify-center relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-dots bg-dots opacity-30 pointer-events-none" />

      {/* Amber glow top */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, transparent 70%)' }}
      />

      {/* Scan line animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute left-0 right-0 h-px bg-amber-500/10"
          style={{ animation: 'scanLine 8s linear infinite', top: 0 }}
        />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-5 shadow-glow-amber">
            <AlertTriangle className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gradient-amber">
            ALERTA CIDADÃO
          </h1>
          <p className="text-xs font-mono text-tertiary mt-1 tracking-widest uppercase">
            Painel de Comando · Defesa Civil
          </p>
        </div>

        {/* Card */}
        <div className="panel p-7 shadow-glow-amber/10">
          {/* Tenant field */}
          <div className="mb-5">
            <label className="data-label block mb-2">Município</label>
            <input
              type="text"
              value={tenant}
              onChange={e => setTenant(e.target.value)}
              placeholder="slug-da-cidade (ex: iguaba)"
              className="input"
              autoComplete="organization"
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="data-label block mb-2">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@prefeitura.rj.gov.br"
                className="input"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="data-label block mb-2">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pr-10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-secondary transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-critical text-xs font-mono bg-critical-bg border border-critical-border rounded px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'btn-primary w-full justify-center mt-2',
                loading && 'opacity-70 cursor-not-allowed',
              )}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Autenticando...</>
              ) : 'Entrar no Painel'}
            </button>
          </form>

          {/* Divisor */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-2xs font-mono text-tertiary uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Google */}
          <button
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="btn-secondary w-full justify-center"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
            </svg>
            Entrar com Google
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-2xs font-mono text-tertiary mt-6">
          © {new Date().getFullYear()} Alerta Cidadão · Todos os direitos reservados
        </p>
      </div>

      <style jsx global>{`
        @keyframes scanLine {
          0%   { top: -2px; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.3; }
          100% { top: 100vh; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
