import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShieldAlert, RefreshCcw, ShieldCheck, Database, HardDrive, 
  DollarSign, AlertOctagon, TrendingDown, Layers, Terminal, AlertCircle
} from 'lucide-react';
import TelemetryCharts from './components/TelemetryCharts.tsx';
import AnomalyFeed from './components/AnomalyFeed.tsx';
import ProductManager from './components/ProductManager.tsx';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function App() {
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeTab, setActiveTab] = useState<'audit' | 'products'>('audit');

  // Simple state-based premium toast notification helper
  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // 1. Query for live environment telemetry connection pool
  const { data: telemetry } = useQuery({
    queryKey: ['systemTelemetry'],
    queryFn: async () => {
      const res = await fetch('/api/telemetry/system');
      if (!res.ok) throw new Error('Telemetry offline');
      return res.json();
    },
    refetchInterval: 5000,
  });

  // 2. Query executive KPI totals
  const { data: kpis, isLoading: isKpisLoading } = useQuery({
    queryKey: ['telemetrySummary'],
    queryFn: async () => {
      const res = await fetch('/api/telemetry/summary');
      if (!res.ok) throw new Error('KPI summary error');
      return res.json() as Promise<{
        activeAnomalies: number;
        criticalSeverity: number;
        highReturnRatioRisks: number;
        totalRevenueStalled: number;
      }>;
    },
    refetchInterval: 10000,
  });

  // 3. System audit sweeper mutation
  const auditMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/detection/run', { method: 'POST' });
      if (!res.ok) throw new Error('Analytical audit execution failed.');
      return res.json();
    },
    onSuccess: (data) => {
      addToast(`Database Sweep Successful. Injected ${data.insertedCount} new exception anomalies.`, 'success');
      // Invalidate queries to trigger instant updates across all components
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['telemetrySummary'] });
      queryClient.invalidateQueries({ queryKey: ['categoryChartData'] });
    },
    onError: (err: any) => {
      addToast(`Audit Failed: ${err.message}`, 'error');
    }
  });

  const handleTriggerAudit = () => {
    addToast('Executing 5 multi-table raw SQL detection engines in PG kernel...', 'info');
    auditMutation.mutate();
  };

  return (
    <div className="min-h-screen text-slate-100 pb-12 relative">
      {/* Background neon glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] bg-violet-500/5 rounded-full blur-[180px] pointer-events-none" />

      {/* 🚀 1. SYSTEM CONTROL HEADER */}
      <header className="sticky top-0 z-40 bg-[#040810]/75 backdrop-blur-md border-b border-white/5 py-5 px-6 mb-8 shadow-lg overflow-visible">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 min-h-[72px]">
          
          <div className="flex items-center gap-4 shrink-0">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-violet-600 flex items-center justify-center shadow-md shadow-cyan-500/20 ring-1 ring-white/10">
              <div className="relative h-7 w-7 flex items-center justify-center">
                <div className="absolute inset-0 rounded-lg bg-white/10 rotate-12" />
                <span className="relative text-white font-black text-lg tracking-tight">R</span>
              </div>
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black uppercase tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-300">
                  RIETS
                </h1>
                <span className="text-[10px] font-extrabold text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded-full bg-cyan-950/20 uppercase tracking-widest">
                  v1.2 Enterprise
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400 font-semibold uppercase tracking-[0.22em]">Retail Intelligence & Exception Tracking System</p>
            </div>
          </div>

          {/* Controller & Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            
            {/* Database indicator */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-300 ${
              telemetry?.dbStatus === 'Operational' 
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' 
                : 'bg-amber-950/40 border-amber-500/30 text-amber-400'
            }`}>
              <ShieldCheck className={`h-4 w-4 ${telemetry?.dbStatus === 'Operational' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
              DB Sync: {telemetry?.dbStatus === 'Operational' ? 'Active' : 'Simulation'}
            </span>

            {/* Neon pool connection badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-300 ${
              telemetry?.neonPoolStatus === 'Stable'
                ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-400'
                : 'bg-purple-950/40 border-purple-500/30 text-purple-400'
            }`}>
              <Database className="h-4 w-4" />
              Neon Pool: {telemetry?.neonPoolStatus || 'Stable'}
            </span>

            {/* Sweeper trigger */}
            <button
              onClick={handleTriggerAudit}
              disabled={auditMutation.isPending}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-purple-650 hover:from-cyan-500 hover:to-purple-600 border border-cyan-400/20 hover:border-cyan-400/40 text-white rounded-lg text-xs font-black shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 flex items-center gap-2 transition duration-200 disabled:opacity-50"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${auditMutation.isPending ? 'animate-spin' : ''}`} />
              Trigger System Audit
            </button>

          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6">

        {/* 🚀 2. SYSTEM HEALTH & METRICS STRIP */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          {/* Card 1: Active Discrepancies */}
          <div className="glass-panel p-5 rounded-xl flex items-center justify-between border-l-2 border-l-cyan-500 hover:border-l-cyan-400 transition-all duration-300">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Active Exceptions</p>
              <h3 className="text-2xl font-black text-slate-100 tech-font">
                {isKpisLoading ? '---' : (kpis?.activeAnomalies ?? 0)}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Pending analyst evaluation</p>
            </div>
            <div className="p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-lg text-cyan-400">
              <Layers className="h-6 w-6" />
            </div>
          </div>

          {/* Card 2: Critical threats count */}
          <div className={`glass-panel p-5 rounded-xl flex items-center justify-between border-l-2 hover:border-l-rose-400 transition-all duration-300 ${kpis?.criticalSeverity && kpis.criticalSeverity > 0 ? 'border-l-rose-500 animate-threat-pulse' : 'border-l-rose-500'}`}>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Critical Threat Level</p>
              <h3 className="text-2xl font-black text-rose-450 tech-font">
                {isKpisLoading ? '---' : (kpis?.criticalSeverity ?? 0)}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Immediate action required</p>
            </div>
            <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-lg text-rose-400">
              <AlertOctagon className="h-6 w-6" />
            </div>
          </div>

          {/* Card 3: Return ratio issues */}
          <div className="glass-panel p-5 rounded-xl flex items-center justify-between border-l-2 border-l-amber-500 hover:border-l-amber-400 transition-all duration-300">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Return Ratio Excess</p>
              <h3 className="text-2xl font-black text-amber-450 tech-font">
                {isKpisLoading ? '---' : (kpis?.highReturnRatioRisks ?? 0)}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">SKUs with returns &gt; 45%</p>
            </div>
            <div className="p-3 bg-amber-950/30 border border-amber-500/20 rounded-lg text-amber-400">
              <TrendingDown className="h-6 w-6" />
            </div>
          </div>

          {/* Card 4: Stalled Capital */}
          <div className="glass-panel p-5 rounded-xl flex items-center justify-between border-l-2 border-l-purple-500 hover:border-l-purple-400 transition-all duration-300">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Stalled Capital</p>
              <h3 className="text-2xl font-black text-purple-400 tech-font">
                {isKpisLoading ? '---' : `$${(kpis?.totalRevenueStalled ?? 0).toLocaleString()}`}
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Value on stock with zero sales</p>
            </div>
            <div className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-lg text-purple-400">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>

        </section>

        {/* Real-time resource Telemetry and Composed trends */}
        <TelemetryCharts />

        {/* Tab Selection */}
        <div className="flex border-b border-white/5 mb-6 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-6 border-b-2 transition ${
              activeTab === 'audit' 
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/[0.02]' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Exception Core Auditing Feed
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`py-3 px-6 border-b-2 transition ${
              activeTab === 'products' 
                ? 'border-purple-500 text-purple-400 bg-purple-500/[0.02]' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Catalog Registry Management
          </button>
        </div>

        {/* Active Tab Screen */}
        <div className="animate-in fade-in duration-200">
          {activeTab === 'audit' ? (
            <AnomalyFeed />
          ) : (
            <ProductManager />
          )}
        </div>

      </main>

      {/* 🛎️ TOAST NOTIFICATION STACK */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-lg border text-xs font-semibold flex items-start gap-2.5 animate-in slide-in-from-right-10 duration-200 relative overflow-hidden ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                : toast.type === 'error'
                ? 'bg-red-950/90 border-red-500/40 text-red-300'
                : 'bg-slate-900/95 border-cyan-500/40 text-cyan-300'
            }`}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-current" />
            <AlertCircle className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              {toast.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
