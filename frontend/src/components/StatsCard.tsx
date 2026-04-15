'use client';

const colors: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  red: 'bg-red-50 border-red-200 text-red-700',
};

export function StatsCard({ label, value, color = 'blue' }: { label: string; value: any; color?: string }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${colors[color] ?? colors.blue}`}>
      <p className="text-sm font-medium opacity-70">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
