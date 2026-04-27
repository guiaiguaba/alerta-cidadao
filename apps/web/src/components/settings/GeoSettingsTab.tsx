'use client';
// components/settings/GeoSettingsTab.tsx
// Aba "Área de Cobertura" — configura raio geográfico para o app do cidadão
// Usa Leaflet (já importado como dynamic no projeto)

import { useEffect, useRef, useState } from 'react';
import { adminApi } from '@/lib/api/client';
import { Loader2, Save, MapPin, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

// Leaflet só no cliente (SSR disabled)
const MapWithRadius = dynamic(() => import('./MapWithRadius'), { ssr: false });

interface GeoConfig {
  center_lat:    number;
  center_lng:    number;
  geo_radius_km: number;
  display_name:  string;
}

export default function GeoSettingsTab({ config }: { config: any }) {
  const [centerLat, setCenterLat]   = useState<number>(config?.center_lat   ?? -22.8486);
  const [centerLng, setCenterLng]   = useState<number>(config?.center_lng   ?? -42.0085);
  const [radiusKm,  setRadiusKm]    = useState<number>(config?.geo_radius_km ?? 30);
  const [radiusInput, setRadiusInput] = useState<string>((config?.geo_radius_km ?? 30).toString());
  const [saving,    setSaving]      = useState(false);
  const [saved,     setSaved]       = useState(false);

  // Sincronizar input de texto com slider/mapa
  function handleRadiusInput(val: string) {
    setRadiusInput(val);
    const n = parseInt(val);
    if (!isNaN(n) && n >= 1 && n <= 200) setRadiusKm(n);
  }

  function handleRadiusSlider(val: number) {
    setRadiusKm(val);
    setRadiusInput(val.toString());
  }

  // Quando o usuário arrasta o marcador no mapa
  function handleCenterChange(lat: number, lng: number) {
    setCenterLat(lat);
    setCenterLng(lng);
  }

  // Quando redimensiona o círculo no mapa
  function handleRadiusChange(km: number) {
    const clamped = Math.min(200, Math.max(1, Math.round(km)));
    setRadiusKm(clamped);
    setRadiusInput(clamped.toString());
  }

  async function salvar() {
    if (radiusKm < 1 || radiusKm > 200) {
      toast.error('Distância deve estar entre 1 e 200 km');
      return;
    }
    setSaving(true);
    try {
      await adminApi.updateTenantConfig({
        centerLat,
        centerLng,
        geoRadiusKm: radiusKm,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success('Área de cobertura salva');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  // Presets de distância
  const PRESETS = [
    { label: '5 km',   value: 5,   desc: 'Área urbana central' },
    { label: '15 km',  value: 15,  desc: 'Município pequeno' },
    { label: '30 km',  value: 30,  desc: 'Município médio (padrão)' },
    { label: '50 km',  value: 50,  desc: 'Município + adjacências' },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-primary mb-1">Área de Cobertura do App</h2>
        <p className="text-xs text-secondary leading-relaxed">
          Define a distância máxima do município em que cidadãos podem se cadastrar,
          fazer login e registrar ocorrências. Fora dessa área, o app bloqueia automaticamente.
        </p>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-2.5 bg-amber-500/6 border border-amber-500/20 rounded-lg p-3.5">
        <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-secondary leading-relaxed">
          <strong className="text-primary">Como funciona:</strong> Ao abrir o app, o GPS do cidadão é verificado.
          Se estiver fora do raio configurado, ele vê uma mensagem explicando que o app é
          exclusivo para moradores de <strong className="text-primary">{config?.display_name ?? 'seu município'}</strong> e
          não consegue fazer nenhuma ação.
        </p>
      </div>

      {/* Mapa interativo */}
      <div>
        <label className="data-label block mb-2">
          Centro do município · Arraste o marcador para ajustar
        </label>
        <div className="rounded-xl overflow-hidden border border-border" style={{ height: 320 }}>
          <MapWithRadius
            centerLat={centerLat}
            centerLng={centerLng}
            radiusKm={radiusKm}
            onCenterChange={handleCenterChange}
            onRadiusChange={handleRadiusChange}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs font-mono text-tertiary">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {centerLat.toFixed(5)}, {centerLng.toFixed(5)}
          </span>
          <span className="text-secondary">
            Raio atual: <strong className="text-amber-400">{radiusKm} km</strong>
          </span>
        </div>
      </div>

      {/* Controle de distância */}
      <div>
        <label className="data-label block mb-3">Distância máxima (km)</label>

        {/* Presets */}
        <div className="flex gap-2 flex-wrap mb-4">
          {PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => { setRadiusKm(p.value); setRadiusInput(p.value.toString()); }}
              className={`px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                radiusKm === p.value
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-panel border-border text-tertiary hover:text-secondary'
              }`}
            >
              <div className="font-semibold">{p.label}</div>
              <div className="text-2xs opacity-70">{p.desc}</div>
            </button>
          ))}
        </div>

        {/* Slider + input numérico lado a lado */}
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={200}
            value={radiusKm}
            onChange={e => handleRadiusSlider(parseInt(e.target.value))}
            className="flex-1 accent-amber-500"
          />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input
              type="number"
              min={1}
              max={200}
              value={radiusInput}
              onChange={e => handleRadiusInput(e.target.value)}
              className="input w-20 text-center font-mono text-sm font-bold"
            />
            <span className="text-xs text-tertiary font-mono">km</span>
          </div>
        </div>

        {/* Escala visual */}
        <div className="flex justify-between text-2xs font-mono text-tertiary mt-1 px-0.5">
          <span>1 km</span>
          <span>50 km</span>
          <span>100 km</span>
          <span>200 km</span>
        </div>
      </div>

      {/* O que acontece fora da área */}
      <div className="bg-surface border border-border rounded-lg p-4 space-y-2.5">
        <p className="text-xs font-semibold text-secondary uppercase tracking-wide font-mono">
          O que o cidadão vê fora da área
        </p>
        {/* Mockup da mensagem de bloqueio */}
        <div className="bg-critical/8 border border-critical/20 rounded-lg p-3.5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-critical flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-critical">App indisponível na sua região</p>
            <p className="text-xs text-secondary mt-1 leading-relaxed">
              Este app é exclusivo para moradores de{' '}
              <strong>{config?.display_name ?? 'seu município'}</strong>.
              Você está a <strong className="text-critical">~347 km</strong> do município.
            </p>
          </div>
        </div>
        <p className="text-2xs text-tertiary font-mono">
          * O bloqueio acontece no login, no cadastro e ao tentar criar uma ocorrência.
        </p>
      </div>

      {/* Salvar */}
      <button
        onClick={salvar}
        disabled={saving}
        className="btn-primary text-xs flex items-center gap-1.5"
      >
        {saving ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
        ) : saved ? (
          <><CheckCircle2 className="w-3.5 h-3.5 text-low" /> Salvo!</>
        ) : (
          <><Save className="w-3.5 h-3.5" /> Salvar Área de Cobertura</>
        )}
      </button>
    </div>
  );
}
