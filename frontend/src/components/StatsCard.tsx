'use client';

const colors: Record<string, { border: string; bg: string; text: string }> = {
  orange: { border: '#FF6B2B', bg: 'rgba(255,107,43,.08)', text: '#FF6B2B' },
  red:    { border: '#EF4444', bg: 'rgba(239,68,68,.08)',  text: '#EF4444' },
  yellow: { border: '#EAB308', bg: 'rgba(234,179,8,.08)',  text: '#EAB308' },
  green:  { border: '#22C55E', bg: 'rgba(34,197,94,.08)',  text: '#22C55E' },
  gray:   { border: '#6B7280', bg: 'rgba(107,114,128,.08)',text: '#6B7280' },
};

export function StatsCard({ label, value, color = 'orange' }: { label: string; value: any; color?: string }) {
  const c = colors[color] ?? colors.orange;
  return (
    <div style={{
      borderRadius: 12, padding: '18px 20px',
      background: '#fff', border: `1px solid #E5E7EB`,
      borderTop: `3px solid ${c.border}`,
    }}>
      <p style={{ fontSize: 34, fontWeight: 800, margin: '0 0 4px', lineHeight: 1, color: '#0F1117' }}>{value}</p>
      <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{label}</p>
    </div>
  );
}
