import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDisciplinaColor } from '../../utils/colors';

interface TimelineDataPoint {
  ano: number;
  [key: string]: number; // assunto: quantidade
}

interface TimelineChartProps {
  data: TimelineDataPoint[];
  assuntos: string[];
  disciplina: string;
}

export function TimelineChart({ data, assuntos, disciplina }: TimelineChartProps) {
  const color = getDisciplinaColor(disciplina);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="ano"
          stroke="#8b949e"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="#8b949e"
          style={{ fontSize: '12px' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#161b22',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '0.5rem',
            color: '#e6edf3',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#8b949e' }}
        />
        {assuntos.slice(0, 5).map((assunto, index) => (
          <Line
            key={assunto}
            type="monotone"
            dataKey={assunto}
            stroke={color}
            strokeWidth={2}
            strokeOpacity={1 - (index * 0.15)}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
