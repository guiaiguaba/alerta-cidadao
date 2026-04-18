'use client';
import { useEffect, useRef } from 'react';

const STATUS_COLORS: Record<string, string> = {
  aberta:       '#EF4444',
  em_andamento: '#FF6B2B',
  resolvida:    '#22C55E',
  cancelada:    '#9CA3AF',
};

const STATUS_LABELS: Record<string, string> = {
  aberta:       'Novo',
  em_andamento: 'Em atendimento',
  resolvida:    'Concluído',
  cancelada:    'Cancelado',
};

interface Ocorrencia {
  id: string;
  latitude: number;
  longitude: number;
  descricao: string;
  status: string;
  prioridade: string;
  categoria_nome?: string;
  endereco?: string;
}

export function OcorrenciasMap({ ocorrencias }: { ocorrencias: Ocorrencia[] }) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    let cancelled = false;

    const init = async () => {
      // Destroi instância anterior
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
      if (cancelled || !mapRef.current) return;

      const L = (await import('leaflet')).default;

      // Injeta CSS do leaflet dinamicamente se ainda não foi injetado
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id   = 'leaflet-css';
        link.rel  = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (cancelled || !mapRef.current) return;

      const valid = ocorrencias.filter(o => o.latitude && o.longitude);
      const center: [number, number] = valid.length > 0
        ? [
            valid.reduce((s, o) => s + o.latitude, 0)  / valid.length,
            valid.reduce((s, o) => s + o.longitude, 0) / valid.length,
          ]
        : [-22.9, -43.1];

      const map = L.map(mapRef.current, { zoomControl: true }).setView(center, valid.length === 1 ? 15 : 12);
      instanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      valid.forEach(o => {
        const color = STATUS_COLORS[o.status] ?? '#FF6B2B';
        const label = STATUS_LABELS[o.status] ?? o.status;

        const icon = L.divIcon({
          html: `
            <div style="
              width: 16px; height: 16px; border-radius: 50%;
              background: ${color}; border: 2.5px solid white;
              box-shadow: 0 1px 6px rgba(0,0,0,.35), 0 0 0 3px ${color}33;
            "></div>`,
          className: '',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        L.marker([o.latitude, o.longitude], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: system-ui; min-width: 160px; padding: 4px 0">
              <strong style="font-size: 13px; color: #111">${o.categoria_nome ?? 'Ocorrência'}</strong><br/>
              <span style="
                display: inline-block; margin: 5px 0;
                background: ${color}20; color: ${color};
                border: 1px solid ${color}55;
                border-radius: 12px; padding: 2px 8px; font-size: 11px; font-weight: 700
              ">${label}</span><br/>
              <span style="font-size: 12px; color: #666; line-height: 1.4">
                ${(o.descricao ?? '').slice(0, 80)}${(o.descricao ?? '').length > 80 ? '...' : ''}
              </span>
              ${o.endereco ? `<br/><span style="font-size: 11px; color: #999; margin-top: 4px; display: block">📍 ${o.endereco}</span>` : ''}
            </div>
          `, { maxWidth: 220 });
      });

      // Ajusta bounds se houver mais de 1 ponto
      if (valid.length > 1) {
        try {
          map.fitBounds(
            valid.map(o => [o.latitude, o.longitude] as [number, number]),
            { padding: [30, 30], maxZoom: 14 },
          );
        } catch { /* ignora */ }
      }
    };

    init();

    return () => {
      cancelled = true;
      instanceRef.current?.remove();
      instanceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocorrencias.length]);

  if (ocorrencias.length === 0) {
    return (
      <div style={{ height: 220, borderRadius: 10, background: '#F9FAFB', border: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 32 }}>🗺️</span>
        <span style={{ fontSize: 13, color: '#9CA3AF' }}>Nenhuma ocorrência no mapa</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div ref={mapRef} style={{ height: 220, borderRadius: 10, overflow: 'hidden', zIndex: 0 }} />
      {/* Legenda */}
      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        background: 'rgba(255,255,255,0.95)', borderRadius: 8,
        padding: '6px 10px', fontSize: 11, lineHeight: '18px',
        boxShadow: '0 1px 4px rgba(0,0,0,.12)', zIndex: 1000,
      }}>
        {Object.entries(STATUS_COLORS).map(([k, c]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
            <span style={{ color: '#374151', fontWeight: 500 }}>{STATUS_LABELS[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
