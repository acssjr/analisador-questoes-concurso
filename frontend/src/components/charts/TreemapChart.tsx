import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { getDisciplinaColor } from '../../utils/colors';

interface TreemapData {
  name: string;
  size: number;
  children?: TreemapData[];
}

interface TreemapChartProps {
  data: TreemapData[];
  disciplina: string;
}

// Recharts passes dynamic props to content components that don't match a static interface
// Using explicit props with defaults handles the runtime behavior correctly
interface CustomContentProps {
  root?: { name: string };
  depth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  size?: number;
}

function CustomContent({ root, depth = 0, x = 0, y = 0, width = 0, height = 0, name = '', size = 0 }: CustomContentProps) {
  const isLargeEnough = width > 60 && height > 40;
  const rootName = root?.name ?? '';

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: depth < 2 ? getDisciplinaColor(rootName) : `${getDisciplinaColor(rootName)}CC`,
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
  // Cast to satisfy Recharts internal types while maintaining our type safety
  const treemapData = data as unknown as Record<string, unknown>[];
  return (
    <ResponsiveContainer width="100%" height={500}>
      <Treemap
        data={treemapData}
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
