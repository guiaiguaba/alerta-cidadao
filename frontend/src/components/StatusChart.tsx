'use client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#EAB308', '#F97316', '#22C55E', '#6B7280'];

export function StatusChart({ data }: { data?: any }) {
  if (!data) return <div className="h-48 flex items-center justify-center text-gray-400">Sem dados</div>;

  const chartData = [
    { name: 'Abertas', value: Number(data.abertas ?? 0) },
    { name: 'Em Andamento', value: Number(data.em_andamento ?? 0) },
    { name: 'Resolvidas', value: Number(data.resolvidas ?? 0) },
  ].filter((d) => d.value > 0);

  if (chartData.length === 0) return <div className="h-48 flex items-center justify-center text-gray-400">Nenhuma ocorrência</div>;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
          {chartData.map((_entry, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
