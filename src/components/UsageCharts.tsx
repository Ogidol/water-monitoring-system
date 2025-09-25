import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  BarChart3, 
  Clock, 
  TrendingUp,
  Activity,
  Zap
} from 'lucide-react';
import { WaterUsageData } from '../services/usageService';

interface UsageChartsProps {
  historicalUsage: WaterUsageData[];
  hourlyUsage: number[];
  is320?: boolean;
  isSmallMobile?: boolean;
}

export function UsageCharts({ historicalUsage, hourlyUsage, is320, isSmallMobile }: UsageChartsProps) {
  
  // Usage Trend Chart Component
  const UsageTrendChart = ({ data }: { data: WaterUsageData[] }) => {
    const width = is320 ? 280 : isSmallMobile ? 320 : 700;
    const height = is320 ? 200 : 280;
    const padding = is320 ? 30 : 60;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    if (!data || data.length === 0) {
      return (
        <div className={`w-full ${is320 ? 'h-48' : 'h-64'} flex items-center justify-center text-gray-500`}>
          <div className="text-center">
            <BarChart3 className={`${is320 ? 'w-8 h-8' : 'w-12 h-12'} mx-auto mb-2 text-gray-400`} />
            <p className={is320 ? 'text-xs' : 'text-sm'}>No usage data available</p>
          </div>
        </div>
      );
    }

    const maxUsage = Math.max(...data.map(d => Math.max(d.dailyUsage, d.dailyIntake)));
    const minUsage = 0;
    const range = maxUsage - minUsage || 1;

    // Show only every nth day for mobile
    const displayData = data.filter((_, index) => 
      index % Math.max(1, Math.floor(data.length / (is320 ? 8 : 15))) === 0
    );

    return (
      <div className={`w-full ${is320 ? 'h-48' : 'h-64'} flex items-center justify-center overflow-x-auto`}>
        <svg
          width={width}
          height={height}
          className="rounded-lg min-w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.8)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0.3)" />
            </linearGradient>
            <linearGradient id="intakeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.8)" />
              <stop offset="100%" stopColor="rgba(16, 185, 129, 0.3)" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent) => {
            const value = (maxUsage * percent) / 100;
            const y = padding + ((maxUsage - value) / range) * chartHeight;
            return (
              <g key={percent}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="rgba(59, 130, 246, 0.1)"
                  strokeDasharray="4,8"
                />
                <text
                  x={padding - (is320 ? 10 : 20)}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={is320 ? '8' : '12'}
                  fill="#6B7280"
                  fontWeight="500"
                >
                  {Math.round(value)}L
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {displayData.map((item, index) => {
            const x = padding + (index / (displayData.length - 1)) * chartWidth;
            const barWidth = Math.max(8, chartWidth / displayData.length * 0.6);
            
            const usageHeight = (item.dailyUsage / range) * chartHeight;
            const intakeHeight = (item.dailyIntake / range) * chartHeight;
            
            const usageY = height - padding - usageHeight;
            const intakeY = height - padding - intakeHeight;

            return (
              <g key={index}>
                {/* Usage bar */}
                <rect
                  x={x - barWidth / 2 - 2}
                  y={usageY}
                  width={barWidth / 2}
                  height={usageHeight}
                  fill="url(#usageGradient)"
                  rx="2"
                />
                
                {/* Intake bar */}
                <rect
                  x={x + 2}
                  y={intakeY}
                  width={barWidth / 2}
                  height={intakeHeight}
                  fill="url(#intakeGradient)"
                  rx="2"
                />
                
                {/* Date label */}
                <text
                  x={x}
                  y={height - padding + (is320 ? 15 : 25)}
                  textAnchor="middle"
                  fontSize={is320 ? '6' : '10'}
                  fill="#6B7280"
                  fontWeight="500"
                >
                  {is320 
                    ? item.date.split('-')[2] 
                    : new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                </text>
              </g>
            );
          })}

          {/* Legend */}
          <g transform={`translate(${width - 120}, ${padding})`}>
            <rect x="0" y="0" width="12" height="8" fill="url(#usageGradient)" rx="2" />
            <text x="16" y="8" fontSize="10" fill="#6B7280">Usage</text>
            <rect x="0" y="15" width="12" height="8" fill="url(#intakeGradient)" rx="2" />
            <text x="16" y="23" fontSize="10" fill="#6B7280">Intake</text>
          </g>
        </svg>
      </div>
    );
  };

  // Hourly Usage Chart Component
  const HourlyUsageChart = ({ data }: { data: number[] }) => {
    const width = is320 ? 280 : 350;
    const height = is320 ? 160 : 200;
    const padding = is320 ? 25 : 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxUsage = Math.max(...data, 1);

    return (
      <div className={`w-full ${is320 ? 'h-40' : 'h-48'} flex items-center justify-center overflow-x-auto`}>
        <svg
          width={width}
          height={height}
          className="rounded-lg min-w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="hourlyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(139, 92, 246, 0.8)" />
              <stop offset="100%" stopColor="rgba(139, 92, 246, 0.3)" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent) => {
            const value = (maxUsage * percent) / 100;
            const y = padding + ((maxUsage - value) / maxUsage) * chartHeight;
            return (
              <line
                key={percent}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="rgba(139, 92, 246, 0.1)"
                strokeDasharray="2,4"
              />
            );
          })}

          {/* Bars */}
          {data.map((usage, hour) => {
            const x = padding + (hour / 23) * chartWidth;
            const barWidth = Math.max(2, chartWidth / 24 * 0.8);
            const barHeight = (usage / maxUsage) * chartHeight;
            const y = height - padding - barHeight;

            return (
              <g key={hour}>
                <rect
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="url(#hourlyGradient)"
                  rx="1"
                />
                
                {/* Hour labels - show every 4 hours */}
                {hour % 4 === 0 && (
                  <text
                    x={x}
                    y={height - padding + (is320 ? 12 : 20)}
                    textAnchor="middle"
                    fontSize={is320 ? '6' : '9'}
                    fill="#6B7280"
                  >
                    {hour}h
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className={`grid grid-cols-1 ${
      isSmallMobile ? '' : 'lg:grid-cols-2'
    } ${is320 ? 'gap-4' : 'gap-6'}`}>
      
      {/* Historical Usage Trend */}
      <Card className="glassmorphism shadow-xl hover:shadow-2xl transition-all duration-300 border-white/30">
        <CardHeader className={is320 ? 'p-3' : ''}>
          <CardTitle className={`${
            is320 ? 'text-lg' : 'text-xl'
          } font-bold text-gray-900 flex items-center justify-between`}>
            <div className="flex items-center">
              <TrendingUp className={`${is320 ? 'w-5 h-5' : 'w-6 h-6'} mr-3 text-blue-600`} />
              {is320 ? 'Usage Trend' : 'Water Usage Trend (30 Days)'}
            </div>
            <Badge className={`bg-blue-100 text-blue-800 ${is320 ? 'text-xs' : 'text-xs'}`}>
              {historicalUsage.length} days
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className={is320 ? 'p-3' : ''}>
          <UsageTrendChart data={historicalUsage.slice(-30)} />
          <div className={`mt-4 grid grid-cols-2 gap-4 ${is320 ? 'text-xs' : 'text-sm'}`}>
            <div className="text-center">
              <div className="text-blue-600 font-semibold">
                {historicalUsage.length > 0 
                  ? Math.round(historicalUsage.reduce((sum, d) => sum + d.dailyUsage, 0) / historicalUsage.length)
                  : 0}L
              </div>
              <div className="text-gray-600">Avg Daily Usage</div>
            </div>
            <div className="text-center">
              <div className="text-green-600 font-semibold">
                {historicalUsage.length > 0 
                  ? Math.round(historicalUsage.reduce((sum, d) => sum + d.dailyIntake, 0) / historicalUsage.length)
                  : 0}L
              </div>
              <div className="text-gray-600">Avg Daily Intake</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hourly Usage Today */}
      <Card className="glassmorphism shadow-xl hover:shadow-2xl transition-all duration-300 border-white/30">
        <CardHeader className={is320 ? 'p-3' : ''}>
          <CardTitle className={`${
            is320 ? 'text-lg' : 'text-xl'
          } font-bold text-gray-900 flex items-center justify-between`}>
            <div className="flex items-center">
              <Clock className={`${is320 ? 'w-5 h-5' : 'w-6 h-6'} mr-3 text-purple-600`} />
              {is320 ? 'Today Hourly' : 'Hourly Usage Today'}
            </div>
            <Badge className={`bg-purple-100 text-purple-800 ${is320 ? 'text-xs' : 'text-xs'}`}>
              24 hours
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className={is320 ? 'p-3' : ''}>
          <HourlyUsageChart data={hourlyUsage} />
          <div className={`mt-4 grid grid-cols-3 gap-2 ${is320 ? 'text-xs' : 'text-sm'}`}>
            <div className="text-center">
              <div className="text-purple-600 font-semibold">
                {Math.round(hourlyUsage.slice(6, 12).reduce((sum, usage) => sum + usage, 0))}L
              </div>
              <div className="text-gray-600">Morning</div>
            </div>
            <div className="text-center">
              <div className="text-purple-600 font-semibold">
                {Math.round(hourlyUsage.slice(12, 18).reduce((sum, usage) => sum + usage, 0))}L
              </div>
              <div className="text-gray-600">Afternoon</div>
            </div>
            <div className="text-center">
              <div className="text-purple-600 font-semibold">
                {Math.round(hourlyUsage.slice(18, 24).reduce((sum, usage) => sum + usage, 0))}L
              </div>
              <div className="text-gray-600">Evening</div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

export default UsageCharts;