'use client';
import { useEffect, useRef } from 'react';

const STATUS_COLORS: Record<string, string> = {
  aberta: '#EF4444',
  em_andamento: '#F97316',
  resolvida: '#22C55E',
  cancelada: '#9CA3AF',
};

interface Ocorrencia {
  id: string;
  latitude: number;
  longitude: number;
  descricao: string;
  status: string;
  prioridade: string;
  categoria_nome?: string;
}

export function OcorrenciasMap({ ocorrencias }: { ocorrencias: Ocorrencia[] }) {
  const mapRef = useRef<any>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const init = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }

      if (!mapRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: true }).setView([-22.9, -43.1], 10);
      instanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      ocorrencias.forEach((o) => {
        if (!o.latitude || !o.longitude) return;
        const color = STATUS_COLORS[o.status] ?? '#3B82F6';
        const icon = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        L.marker([o.latitude, o.longitude], { icon })
          .addTo(map)
          .bindPopup(
            `<strong>${o.categoria_nome ?? 'Ocorrência'}</strong><br/>
             ${o.descricao.slice(0, 100)}${o.descricao.length > 100 ? '...' : ''}<br/>
             <span style="color:${color};font-weight:bold">${o.status.replace('_', ' ')}</span>`,
          );
      });

      if (ocorrencias.length > 0) {
        const valid = ocorrencias.filter((o) => o.latitude && o.longitude);
        if (valid.length > 0) {
          map.fitBounds(valid.map((o) => [o.latitude, o.longitude] as [number, number]), { padding: [40, 40] });
        }
      }
    };

    init();
    return () => { instanceRef.current?.remove(); instanceRef.current = null; };
  }, [ocorrencias]);

  return <div ref={mapRef} style={{ height: '220px', borderRadius: '8px', zIndex: 0 }} />;
}
