import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Area, ComposedChart
} from 'recharts';
import { Cpu, Database, Activity, HardDrive } from 'lucide-react';

interface TelemetryPoint {
  time: string;
  cpu: number;
  memory: number;
  connections: number;
}

export default function TelemetryCharts() {
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>([]);

  // 1. Fetch system telemetry (every 5 seconds)
  const { data: systemData } = useQuery({
    queryKey: ['systemTelemetry'],
    queryFn: async () => {
      const res = await fetch('/api/telemetry/system');
      if (!res.ok) throw new Error('Telemetry offline');
      return res.json();
    },
    refetchInterval: 5000, // poll every 5 seconds
  });

  // 2. Fetch category sales metrics
  const { data: categoryData, isLoading: isCategoryLoading } = useQuery({
    queryKey: ['categoryChartData'],
    queryFn: async () => {
      const res = await fetch('/api/telemetry/category-chart');
      if (!res.ok) throw new Error('Failed to fetch category data');
      return res.json();
    },
    refetchInterval: 15000, // refresh charts every 15s
  });

  // Append telemetry to sliding history window
  useEffect(() => {
    if (systemData) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      const newPoint: TelemetryPoint = {
        time: timeStr,
        cpu: systemData.cpu,
        memory: systemData.memory.percentage,
        connections: systemData.dbConnections
      };

      setTelemetryHistory(prev => {
        const next = [...prev, newPoint];
        if (next.length > 15) {
          next.shift(); // keep last 15 points
        }
        return next;
      });
    }
  }, [systemData]);

  // Initial history builder to avoid empty charts on boot
  useEffect(() => {
    if (telemetryHistory.length === 0) {
      const mockInitial: TelemetryPoint[] = [];
      const now = Date.now();
      for (let i = 14; i >= 0; i--) {
        const t = new Date(now - i * 5000);
        mockInitial.push({
          time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          cpu: 20 + Math.random() * 15,
          memory: 26 + Math.random() * 2,
          connections: 0
        });
      }
      setTelemetryHistory(mockInitial);
    }
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* 🚀 TELEMETRY WIDGET */}
      <div className="glass-panel p-6 rounded-xl relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -z-10" />
        
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Activity className="h-5 w-5 text-cyan-400 animate-pulse" />
                Real-Time Resource Telemetry
              </h3>
              <p className="text-xs text-slate-400">Sliding runtime telemetry audit (5s polling interval)</p>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-cyan-400 tech-font">
                <Cpu className="h-3.5 w-3.5" />
                CPU: {systemData?.cpu !== undefined ? `${systemData.cpu}%` : '---'}
              </span>
              <span className="flex items-center gap-1.5 text-purple-400 tech-font">
                <HardDrive className="h-3.5 w-3.5" />
                RAM: {systemData?.memory !== undefined ? `${systemData.memory.percentage}%` : '---'}
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400 tech-font">
                <Database className="h-3.5 w-3.5" />
                Pool: {systemData?.dbConnections !== undefined ? systemData.dbConnections : 0} Connections
              </span>
            </div>
          </div>

          <div className="h-64 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetryHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpuGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="memGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis 
                  dataKey="time" 
                  stroke="rgba(255,255,255,0.3)" 
                  tick={{ fontSize: 9 }}
                  dy={5}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.3)" 
                  domain={[0, 100]}
                  tick={{ fontSize: 9 }}
                  dx={-5}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(10, 18, 32, 0.95)', 
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#fff'
                  }} 
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line 
                  name="CPU Load (%)" 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line 
                  name="Memory Limit (%)" 
                  type="monotone" 
                  dataKey="memory" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 📊 TELEMETRY TRENDS & SALES CHART */}
      <div className="glass-panel p-6 rounded-xl relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -z-10" />

        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Database className="h-5 w-5 text-purple-400" />
                Sales Volume vs Returns By Category
              </h3>
              <p className="text-xs text-slate-400">Aggregated revenue vs returns profile ($ USD)</p>
            </div>
          </div>

          <div className="h-64 w-full mt-2 flex items-center justify-center">
            {isCategoryLoading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-r-2 border-cyan-400" />
                <span className="text-xs text-slate-500">Querying database aggregations...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={categoryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis 
                    dataKey="category" 
                    stroke="rgba(255,255,255,0.3)" 
                    tick={{ fontSize: 10 }}
                    dy={5}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.3)" 
                    tick={{ fontSize: 10 }}
                    dx={-5}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(10, 18, 32, 0.95)', 
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#fff'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar 
                    name="Gross Sales ($)" 
                    dataKey="sales" 
                    fill="#06b6d4" 
                    radius={[4, 4, 0, 0]} 
                    opacity={0.8}
                    barSize={20}
                  />
                  <Bar 
                    name="Returns & Refunds ($)" 
                    dataKey="returns" 
                    fill="#f43f5e" 
                    radius={[4, 4, 0, 0]} 
                    opacity={0.8}
                    barSize={20}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
