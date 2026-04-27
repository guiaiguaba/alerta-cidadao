'use client';
// components/settings/MapWithRadius.tsx
// Mapa Leaflet com:
//   - Marcador arrastável (centro do município)
//   - Círculo com borda arrastável (raio de cobertura)
// Renderizado apenas no cliente (no SSR)

import { useEffect, useRef } from 'react';

interface Props {
  centerLat:       number;
  centerLng:       number;
  radiusKm:        number;
  onCenterChange:  (lat: number, lng: number) => void;
  onRadiusChange:  (km: number) => void;
}

export default function MapWithRadius({
  centerLat, centerLng, radiusKm, onCenterChange, onRadiusChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markerRef    = useRef<any>(null);
  const circleRef    = useRef<any>(null);
  const handleRef    = useRef<any>(null); // marcador de borda do círculo (para arrastar o raio)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Importar Leaflet dinamicamente (somente no cliente)
    import('leaflet').then(L => {
      // Fix ícones padrão Leaflet com Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Criar mapa com tile CartoDB Dark
      const map = L.map(containerRef.current!, {
        center:   [centerLat, centerLng],
        zoom:     11,
        zoomControl: true,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { subdomains: 'abcd', maxZoom: 19 },
      ).addTo(map);

      // Ícone customizado para o centro (amber)
      const centerIcon = L.divIcon({
        html: `<div style="
          width:22px;height:22px;border-radius:50%;
          background:#F59E0B;
          border:3px solid white;
          box-shadow:0 0 10px rgba(245,158,11,0.6);
        "></div>`,
        className: '',
        iconSize:  [22, 22],
        iconAnchor: [11, 11],
      });

      // Ícone para o handle do raio (borda do círculo)
      const handleIcon = L.divIcon({
        html: `<div style="
          width:14px;height:14px;border-radius:50%;
          background:#3B82F6;
          border:2px solid white;
          box-shadow:0 0 6px rgba(59,130,246,0.5);
          cursor:ew-resize;
        "></div>`,
        className: '',
        iconSize:  [14, 14],
        iconAnchor: [7, 7],
      });

      // Marcador do centro (arrastável)
      const marker = L.marker([centerLat, centerLng], {
        draggable: true,
        icon:      centerIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      marker.bindTooltip('Arraste para mover o centro', {
        permanent: false, direction: 'top',
      });

      // Círculo de cobertura
      const circle = L.circle([centerLat, centerLng], {
        radius:    radiusKm * 1000, // Leaflet usa metros
        color:     '#F59E0B',
        fillColor: '#F59E0B',
        fillOpacity: 0.08,
        weight:    2,
        dashArray: '6 4',
      }).addTo(map);

      // Marcador de handle na borda do círculo (para arrastar e redimensionar)
      const handleLatLng = L.latLng(
        centerLat,
        centerLng + radiusKm / 111.32, // ~111.32 km por grau de longitude no equador
      );

      const handle = L.marker(handleLatLng, {
        draggable:    true,
        icon:         handleIcon,
        zIndexOffset: 900,
      }).addTo(map);

      handle.bindTooltip('Arraste para ajustar o raio', {
        permanent: false, direction: 'right',
      });

      // ---- Eventos ----

      // Mover o centro
      marker.on('drag', (e: any) => {
        const { lat, lng } = e.latlng;
        circle.setLatLng([lat, lng]);

        // Recalcular posição do handle (mesmo raio, nova posição)
        const currentRadiusM = circle.getRadius();
        const newHandleLng = lng + (currentRadiusM / 1000) / 111.32;
        handle.setLatLng([lat, newHandleLng]);
      });

      marker.on('dragend', (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        onCenterChange(lat, lng);
      });

      // Arrastar o handle para mudar o raio
      handle.on('drag', (e: any) => {
        const markerPos  = marker.getLatLng();
        const handlePos  = e.latlng;
        const distM      = markerPos.distanceTo(handlePos);
        const distKm     = distM / 1000;
        circle.setRadius(distM);
        onRadiusChange(distKm);
      });

      // Guardar refs
      mapRef.current    = map;
      markerRef.current = marker;
      circleRef.current = circle;
      handleRef.current = handle;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current    = null;
        markerRef.current = null;
        circleRef.current = null;
        handleRef.current = null;
      }
    };
  }, []); // eslint-disable-line

  // Atualizar círculo quando radiusKm muda externamente (slider/input)
  useEffect(() => {
    if (!circleRef.current || !markerRef.current || !handleRef.current) return;
    const newRadiusM = radiusKm * 1000;
    circleRef.current.setRadius(newRadiusM);

    // Mover handle para a nova posição na borda
    const center = markerRef.current.getLatLng();
    const newHandleLng = center.lng + radiusKm / 111.32;
    handleRef.current.setLatLng([center.lat, newHandleLng]);
  }, [radiusKm]);

  // Atualizar centro quando prop muda
  useEffect(() => {
    if (!markerRef.current || !circleRef.current || !handleRef.current) return;
    const pos = [centerLat, centerLng] as [number, number];
    markerRef.current.setLatLng(pos);
    circleRef.current.setLatLng(pos);
    const newHandleLng = centerLng + radiusKm / 111.32;
    handleRef.current.setLatLng([centerLat, newHandleLng]);
    mapRef.current?.panTo(pos);
  }, [centerLat, centerLng]); // eslint-disable-line

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#0d1117' }}
    />
  );
}
