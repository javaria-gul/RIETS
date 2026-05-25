import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, CheckCircle2, AlertTriangle, Info, ArrowLeft, ArrowRight, RefreshCcw } from 'lucide-react';

interface ProductMetadata {
  id: string;
  sku: string;
  name: string;
  price: string;
  category: string;
}

interface AnomalyLog {
  id: string;
  productId: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  isResolved: boolean;
  detectedAt: string;
  resolvedAt: string | null;
  product: ProductMetadata | null;
}

export default function AnomalyFeed() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('false'); // default to unresolved
  const [typeSearch, setTypeSearch] = useState('');

  // 1. Query exceptions with active filters
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['anomalies', page, severityFilter, resolvedFilter, typeSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        severity: severityFilter,
        isResolved: resolvedFilter === 'all' ? '' : resolvedFilter,
        anomalyType: typeSearch
      });
      const res = await fetch(`/api/anomalies?${params.toString()}`);
      if (!res.ok) throw new Error('Exception feed error');
      return res.json() as Promise<{
        logs: AnomalyLog[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>;
    },
  });

  // 2. Resolve exception mutation
  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/anomalies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isResolved: true })
      });
      if (!res.ok) throw new Error('Could not resolve exception');
      return res.json();
    },
    // Optimistic UI updates
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['anomalies'] });
      const previousAnomalies = queryClient.getQueryData(['anomalies', page, severityFilter, resolvedFilter, typeSearch]);
      
      // Update cache optimistically
      queryClient.setQueryData(
        ['anomalies', page, severityFilter, resolvedFilter, typeSearch],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            logs: old.logs.map((log: AnomalyLog) => 
              log.id === id ? { ...log, isResolved: true, resolvedAt: new Date().toISOString() } : log
            )
          };
        }
      );

      return { previousAnomalies };
    },
    onError: (err, id, context) => {
      if (context?.previousAnomalies) {
        queryClient.setQueryData(
          ['anomalies', page, severityFilter, resolvedFilter, typeSearch],
          context.previousAnomalies
        );
      }
    },
    onSuccess: () => {
      // Invalidate database metrics queries to synchronize dashboard cards
      queryClient.invalidateQueries({ queryKey: ['telemetrySummary'] });
      queryClient.invalidateQueries({ queryKey: ['categoryChartData'] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
    }
  });

  const handleResolve = (id: string) => {
    resolveMutation.mutate(id);
  };

  const severityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-950/60 border border-red-500/30 text-red-400 animate-threat-pulse';
      case 'high':
        return 'bg-amber-950/60 border border-amber-500/30 text-amber-400';
      case 'medium':
        return 'bg-blue-950/60 border border-blue-500/30 text-blue-400';
      default:
        return 'bg-slate-800/60 border border-slate-700/30 text-slate-400';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ShieldAlert className="h-3.5 w-3.5 mr-1" />;
      case 'high':
        return <AlertTriangle className="h-3.5 w-3.5 mr-1" />;
      default:
        return <Info className="h-3.5 w-3.5 mr-1" />;
    }
  };

  return (
    <div className="glass-panel p-6 rounded-xl relative overflow-hidden mb-8">
      <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -z-10" />

      {/* Header and Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-cyan-400" />
            Active Exceptions & Anomaly Logs
          </h3>
          <p className="text-xs text-slate-400">Database analytical exception feed synced in real-time</p>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 border border-white/10 bg-slate-850 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh database logs"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-cyan-400' : ''}`} />
            Sync Logs
          </button>
        </div>
      </div>

      {/* Filter matrix strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Anomaly Severity</label>
          <select 
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            className="w-full text-xs font-semibold p-2.5 rounded-lg bg-slate-900/80 border border-white/10 text-slate-300 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          >
            <option value="">ALL SEVERITIES</option>
            <option value="critical">CRITICAL (Flashing Red)</option>
            <option value="high">HIGH (Amber Alert)</option>
            <option value="medium">MEDIUM (Blue Tech)</option>
            <option value="low">LOW (Standard Audit)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Resolution State</label>
          <select 
            value={resolvedFilter}
            onChange={(e) => { setResolvedFilter(e.target.value); setPage(1); }}
            className="w-full text-xs font-semibold p-2.5 rounded-lg bg-slate-900/80 border border-white/10 text-slate-300 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          >
            <option value="false">ACTIVE DISCREPANCIES (Unresolved)</option>
            <option value="true">RESOLVED EXCEPTIONS</option>
            <option value="all">HISTORICAL LOG AUDIT (All Records)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search Exception Type</label>
          <input 
            type="text"
            placeholder="Search e.g. Return, Inactive, Drop..."
            value={typeSearch}
            onChange={(e) => { setTypeSearch(e.target.value); setPage(1); }}
            className="w-full text-xs font-semibold p-2.5 rounded-lg bg-slate-900/80 border border-white/10 text-slate-300 placeholder:text-slate-650 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5">
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Exception Core</th>
              <th className="py-3 px-4">Sabotaged SKU / Name</th>
              <th className="py-3 px-4 hidden md:table-cell">Details / Analytics Trace</th>
              <th className="py-3 px-4">Detected At</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs text-slate-300">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-r-2 border-cyan-400" />
                    <span className="font-semibold text-slate-400">Executing Postgres index scan...</span>
                  </div>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-rose-400 font-semibold">
                  ❌ System audit connection failure. Ensure database is seeding.
                </td>
              </tr>
            ) : !data || data.logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500 font-medium">
                  🔍 No exception anomalies matching current audit parameters. Click "Trigger System Audit" above to launch database sweep.
                </td>
              </tr>
            ) : (
              data.logs.map((log) => (
                <tr 
                  key={log.id} 
                  className={`hover:bg-white/2 transition-colors ${log.isResolved ? 'opacity-50' : ''} ${log.severity === 'critical' && !log.isResolved ? 'bg-red-500/[0.02]' : ''}`}
                >
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${severityBadgeClass(log.severity)}`}>
                      {getSeverityIcon(log.severity)}
                      {log.severity}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-200">{log.anomalyType}</td>
                  <td className="py-3.5 px-4">
                    {log.product ? (
                      <div className="flex flex-col">
                        <span className="font-extrabold text-cyan-400 tech-font">{log.product.sku}</span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[180px]">{log.product.name}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500">Retired SKU ({log.productId.slice(0, 8)}...)</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 hidden md:table-cell text-slate-400 font-medium leading-relaxed max-w-[280px]">
                    {log.description}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 tech-font">
                    {new Date(log.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    <span className="block text-[9px]">{new Date(log.detectedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {log.isResolved ? (
                      <span className="inline-flex items-center text-emerald-400 font-extrabold text-[11px] gap-1 pr-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Resolved
                      </span>
                    ) : (
                      <button
                        onClick={() => handleResolve(log.id)}
                        disabled={resolveMutation.isPending}
                        className="px-2.5 py-1 text-[11px] font-bold border border-cyan-500/30 hover:border-cyan-400 bg-cyan-950/30 hover:bg-cyan-500/20 text-cyan-300 rounded shadow-sm transition hover:shadow-cyan-500/10"
                      >
                        Resolve Exception
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
          <span className="text-xs text-slate-400">
            Showing <strong className="text-slate-200">{(page - 1) * 10 + 1}-{Math.min(page * 10, data.pagination.total)}</strong> of <strong className="text-slate-200">{data.pagination.total}</strong> active threats
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 border border-white/10 hover:bg-slate-800 rounded disabled:opacity-40 disabled:hover:bg-transparent text-slate-300 transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <span className="text-xs font-semibold text-slate-300 px-2">
              Page {page} / {data.pagination.totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page === data.pagination.totalPages}
              className="p-1.5 border border-white/10 hover:bg-slate-800 rounded disabled:opacity-40 disabled:hover:bg-transparent text-slate-300 transition"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
