'use client';
import { useEffect, useRef, useState } from 'react';
import { occurrencesApi } from '@/lib/api/client';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { PRIORITY_COLORS, STATUS_LABELS, formatRelative } from '@/lib/utils';

interface OccurrenceMapProps {
  height?:    string;
  className?: string;
  filters?:   Record<string, any>;
}

export function OccurrenceMap({ height = '400px', className = '', filters }: OccurrenceMapProps) {
  const mapRef       = useRef<any>(null);
  const leafletRef   = useRef<any>(null);
  const markersRef   = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { on }       = useWebSocket();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || leafletRef.current) return;

    // Carregar Leaflet dinamicamente (SSR-safe)
    import('leaflet').then(L => {
      if (leafletRef.current) return;

      // Fix ícones padrão do Leaflet
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: [-22.8486, -42.0085],
        zoom:   13,
        zoomControl: true,
        attributionControl: false,
      });

      // Tile layer dark (CartoDB Dark Matter)
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 19, subdomains: 'abcd' },
      ).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);

      leafletRef.current = L;
      mapRef.current     = map;
      markersRef.current = markersGroup;

      loadMarkers(L, markersGroup);
    });

    return () => {
      mapRef.current?.remove();
      leafletRef.current = null;
      mapRef.current     = null;
    };
  }, []);

  async function loadMarkers(L: any, group: any) {
    setLoading(true);
    try {
      const geojson = await occurrencesApi.getMapData({
        status: filters?.status ?? 'open',
        ...filters,
      });

      group.clearLayers();

      geojson.features.forEach((f: any) => {
        const { priority, protocol, categoryName, status, address, createdAt } = f.properties;
        const [lng, lat] = f.geometry.coordinates;
        const color = PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] ?? '#6B7280';

        const icon = L.divIcon({
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          html: `<div style="
            width: 14px; height: 14px; border-radius: 50%;
            background: ${color};
            border: 2px solid rgba(255,255,255,0.3);
            box-shadow: 0 0 8px ${color}88;
          "></div>`,
        });

        const marker = L.marker([lat, lng], { icon });

        marker.bindPopup(`
          <div style="font-family: 'IBM Plex Mono', monospace; min-width: 200px;">
            <p style="font-size: 11px; color: #4E5A6B; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;">
              ${protocol}
            </p>
            <p style="font-size: 13px; font-weight: 600; color: #E8EDF5; margin-bottom: 4px;">
              ${categoryName}
            </p>
            <p style="font-size: 11px; color: #8A96A8; margin-bottom: 8px;">
              ${address ?? 'Endereço não informado'}
            </p>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="
                background: ${color}22; border: 1px solid ${color}44; color: ${color};
                font-size: 10px; padding: 2px 6px; border-radius: 2px; text-transform: uppercase;
              ">${priority}</span>
              <span style="color: #4E5A6B; font-size: 10px;">${STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}</span>
            </div>
            <p style="font-size: 10px; color: #4E5A6B; margin-top: 6px;">${formatRelative(createdAt)}</p>
          </div>
        `, { maxWidth: 280 });

        group.addLayer(marker);
      });
    } catch (err) {
      console.error('Erro ao carregar mapa:', err);
    } finally {
      setLoading(false);
    }
  }

  // Atualizar marcadores quando chegar nova ocorrência
  useEffect(() => {
    const off = on('occurrence:created', () => {
      if (leafletRef.current && markersRef.current) {
        loadMarkers(leafletRef.current, markersRef.current);
      }
    });
    return off;
  }, [on]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-base/80 z-10">
          <p className="text-2xs font-mono text-tertiary animate-pulse">Carregando mapa...</p>
        </div>
      )}
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {/* Carregar CSS do Leaflet */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
    </div>
  );
}
