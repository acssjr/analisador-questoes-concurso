import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { getDisciplinaColor } from '../../utils/colors';

interface TreemapData {
  name: string;
  size: number;
  children?: TreemapData[];
  [key: string]: any;
}

interface TreemapChartProps {
  data: TreemapData[];
  disciplina: string;
}

function CustomContent({ root, depth, x, y, width, height, name, size }: any) {
  const isLargeEnough = width > 60 && height > 40;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: depth < 2 ? getDisciplinaColor(root.name) : `${getDisciplinaColor(root.name)}CC`,
          stroke: '#0a0e14',
          strokeWidth: 2,
          opacity: depth === 0 ? 0.9 : 0.7,
        }}
      />
      {isLargeEnough && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 8}
            textAnchor="middle"
            fill="#fff"
            fontSize={depth === 0 ? 14 : 12}
            fontWeight={depth === 0 ? 'bold' : 'normal'}
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 8}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
            opacity={0.8}
          >
            {size} questões
          </text>
        </>
      )}
    </g>
  );
}

export function TreemapChart({ data, disciplina }: TreemapChartProps) {
  return (
    <ResponsiveContainer width="100%" height={500}>
      <Treemap
        data={data}
        dataKey="size"
        stroke="#0a0e14"
        fill={getDisciplinaColor(disciplina)}
        content={<CustomContent root={{ name: disciplina }} />}
      >
        <Tooltip
          contentStyle={{
            backgroundColor: '#161b22',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '0.5rem',
            color: '#e6edf3',
          }}
          formatter={(value: number | undefined) => [`${value || 0} questões`, 'Total']}
        />
      </Treemap>
    </ResponsiveContainer>
  );
}
