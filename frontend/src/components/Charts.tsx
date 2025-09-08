import React from 'react';

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  data: ChartDataPoint[];
  maxValue?: number;
  showValues?: boolean;
  title?: string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  maxValue,
  showValues = true,
  title
}) => {
  const max = maxValue || Math.max(...data.map(d => d.value)) || 1;

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>}
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center">
            <div className="w-20 text-sm text-gray-600 truncate">
              {item.label}
            </div>
            <div className="flex-1 mx-3">
              <div className="bg-gray-200 rounded-full h-6 relative">
                <div
                  className="rounded-full h-6 transition-all duration-300"
                  style={{
                    width: `${(item.value / max) * 100}%`,
                    backgroundColor: item.color || '#3B82F6'
                  }}
                ></div>
                {showValues && (
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <span className="text-xs font-medium text-gray-700">
                      {item.value}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface SimpleLineChartProps {
  data: Array<{ x: string; y: number }>;
  height?: number;
  color?: string;
  title?: string;
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  data,
  height = 200,
  color = '#3B82F6',
  title
}) => {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.y)) || 1;
  const minValue = Math.min(...data.map(d => d.y)) || 0;
  const range = maxValue - minValue || 1;

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((point.y - minValue) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>}
      <div className="relative">
        <svg width="100%" height={height} className="border border-gray-200 rounded">
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            points={points}
            vectorEffect="non-scaling-stroke"
          />
          {data.map((point, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = 100 - ((point.y - minValue) / range) * 100;
            return (
              <circle
                key={index}
                cx={`${x}%`}
                cy={`${y}%`}
                r="3"
                fill={color}
              />
            );
          })}
        </svg>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          {data.map((point, index) => (
            <span key={index} className="truncate">
              {point.x}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

interface SimplePieChartProps {
  data: ChartDataPoint[];
  size?: number;
  title?: string;
}

export const SimplePieChart: React.FC<SimplePieChartProps> = ({
  data,
  size = 200,
  title
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  if (total === 0) return null;

  let cumulativePercentage = 0;
  const slices = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const startAngle = (cumulativePercentage / 100) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((cumulativePercentage + percentage) / 100) * 2 * Math.PI - Math.PI / 2;
    
    const x1 = Math.cos(startAngle);
    const y1 = Math.sin(startAngle);
    const x2 = Math.cos(endAngle);
    const y2 = Math.sin(endAngle);
    
    const largeArc = percentage > 50 ? 1 : 0;
    
    const pathData = [
      'M', 0, 0,
      'L', x1, y1,
      'A', 1, 1, 0, largeArc, 1, x2, y2,
      'Z'
    ].join(' ');

    cumulativePercentage += percentage;

    return {
      pathData,
      color: item.color || `hsl(${(index * 360) / data.length}, 70%, 50%)`,
      percentage: Math.round(percentage),
      label: item.label,
      value: item.value
    };
  });

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>}
      <div className="flex items-center justify-center">
        <div className="relative">
          <svg width={size} height={size} viewBox="-1 -1 2 2" className="transform -rotate-90">
            {slices.map((slice, index) => (
              <path
                key={index}
                d={slice.pathData}
                fill={slice.color}
                stroke="white"
                strokeWidth="0.02"
              />
            ))}
          </svg>
        </div>
        <div className="ml-6 space-y-2">
          {slices.map((slice, index) => (
            <div key={index} className="flex items-center text-sm">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: slice.color }}
              ></div>
              <span className="text-gray-700">
                {slice.label}: {slice.value} ({slice.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'stable';
  icon?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  trend,
  icon,
  color = 'blue'
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200'
  };

  const trendIcons = {
    up: '↗️',
    down: '↘️',
    stable: '➡️'
  };

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {change && trend && (
            <div className="flex items-center mt-2">
              <span className="text-sm">
                {trendIcons[trend]} {change}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="text-3xl opacity-75">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

interface ProgressBarProps {
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  value,
  maxValue = 100,
  color = '#3B82F6',
  showPercentage = true
}) => {
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {showPercentage && (
          <span className="text-sm text-gray-500">{Math.round(percentage)}%</span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: color
          }}
        ></div>
      </div>
    </div>
  );
};
