'use client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Cores 100% laranja e semânticas — sem azul
const COLORS = [
  '#EF4444', // Abertas (vermelho)
  '#FF6B2B', // Em andamento (laranja)
  '#22C55E', // Resolvidas (verde)
  '#9CA3AF', // Canceladas (cinza)
];

const LABELS: Record<string, string> = {
  abertas:      'Abertas',
  em_andamento: 'Em Andamento',
  resolvidas:   'Resolvidas',
  canceladas:   'Canceladas',
};

export function StatusChart({ data }: { data?: any }) {
  if (!data) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 32 }}>📊</span>
        <span style={{ fontSize: 13, color: '#9CA3AF' }}>Sem dados</span>
      </div>
    );
  }

  const chartData = [
    { name: 'Abertas',      value: Number(data.abertas      ?? 0) },
    { name: 'Em Andamento', value: Number(data.em_andamento ?? 0) },
    { name: 'Resolvidas',   value: Number(data.resolvidas   ?? 0) },
  ].filter(d => d.value > 0);

  if (chartData.length === 0) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 32 }}>📭</span>
        <span style={{ fontSize: 13, color: '#9CA3AF' }}>Nenhuma ocorrência ainda</span>
      </div>
    );
  }

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%" cy="50%"
          innerRadius={45}
          outerRadius={75}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((_entry, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [
            `${value} (${((value / total) * 100).toFixed(0)}%)`, name,
          ]}
          contentStyle={{
            background: '#1A1D27', border: '1px solid #2E3347',
            borderRadius: 8, fontSize: 12, color: '#fff',
          }}
        />
        <Legend
          iconSize={8}
          iconType="circle"
          formatter={(value) => <span style={{ fontSize: 11, color: '#6B7280' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
