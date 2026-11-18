import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { formatLiters, formatPeso } from '../lib/format';
import type { DashboardAnalytics } from '../lib/types';
import type { ActiveSection } from '../App';

interface DashboardViewProps {
  onNavigate?: (section: ActiveSection) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<'REVENUE' | 'VOLUME'>('REVENUE');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [stationFilter, setStationFilter] = useState<string>('all');

  const loadAnalytics = async (targetStation = stationFilter) => {
    setLoading(true);
    try {
      const res = await api.getAnalytics(targetStation === 'all' ? 'all' : Number(targetStation));
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics(stationFilter);
  }, [stationFilter]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-xl p-6 text-sm text-red-700 dark:text-red-300">
        {error || 'Analytics unavailable.'}
      </div>
    );
  }

  const { kpis, paymentBreakdown, lowStockAlerts, dailySeries, topFuel, topStore, stations, stationBreakdown } = data;
  const maxRevenue = Math.max(1000, ...dailySeries.map((d) => d.totalRevenue));
  const maxLiters = Math.max(50, ...dailySeries.map((d) => d.liters));
  const activeDay = hoveredIdx !== null ? dailySeries[hoveredIdx] : dailySeries[dailySeries.length - 1];

  const fuelPctShare =
    kpis.weeklyRevenue > 0 ? Math.round((kpis.weeklyFuelRevenue / kpis.weeklyRevenue) * 100) : 0;
  const storePctShare = kpis.weeklyRevenue > 0 ? 100 - fuelPctShare : 0;

  return (
    <div className="space-y-6">
      {/* Admin Station Filter Bar */}
      {stations && stations.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Station Analytics Scope</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {stationFilter === 'all'
                ? `Aggregated metrics across ${stations.length} gas stations`
                : `Filtered to ${stations.find((s) => String(s.id) === stationFilter)?.brand || ''} · ${stations.find((s) => String(s.id) === stationFilter)?.name || ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter analytics by gas station"
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="all">All Gas Stations ({stations.length})</option>
              {stations.map((st) => (
                <option key={st.id} value={String(st.id)}>
                  {st.code} · {st.brand} — {st.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => loadAnalytics(stationFilter)}
              aria-label="Refresh analytics"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}

      {/* Low Stock / Low Tank Alert Strip */}
      {lowStockAlerts && lowStockAlerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Restock Attention Needed: </span>
              <span>
                {lowStockAlerts
                  .map((a) =>
                    stations && stations.length > 0 && stationFilter === 'all'
                      ? `[${a.stationName}] ${a.name} (${a.remaining})`
                      : `${a.name} (${a.remaining})`
                  )
                  .join(' · ')}
              </span>
            </div>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('INVENTORY')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:text-amber-700 dark:hover:text-amber-100 whitespace-nowrap"
            >
              <span>Manage Stock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Today&apos;s Revenue</p>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1.5">
            {formatPeso(kpis.todayRevenue)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            {kpis.todayTransactions} completed txns
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Fuel Volume Today</p>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1.5">
            {formatLiters(kpis.todayLiters)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All grades combined</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Open Shift Total</p>
          <p className="font-mono text-2xl font-bold text-teal-700 dark:text-teal-400 mt-1.5">
            {formatPeso(kpis.openShiftTotal)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            {kpis.openShiftCount} unclosed receipts
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">7-Day Gross Revenue</p>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1.5">
            {formatPeso(kpis.weeklyRevenue)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            {formatLiters(kpis.weeklyLiters)} dispensed
          </p>
        </div>
      </div>

      {/* 7-Day Revenue Chart + Payment & Mix Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">7-Day Station Performance</h2>
              {activeDay && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  {activeDay.label} · Fuel {formatPeso(activeDay.fuelRevenue)} · Store{' '}
                  {formatPeso(activeDay.storeRevenue)} · {formatLiters(activeDay.liters)}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              {chartMetric === 'REVENUE' && (
                <div className="hidden sm:flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 dark:bg-slate-200 inline-block" />
                    Fuel
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-teal-600 dark:bg-teal-400 inline-block" />
                    Store
                  </span>
                </div>
              )}

              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setChartMetric('REVENUE')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    chartMetric === 'REVENUE' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Revenue (₱)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('VOLUME')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    chartMetric === 'VOLUME' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Fuel Volume (L)
                </button>
              </div>

              <button
                type="button"
                onClick={() => loadAnalytics(stationFilter)}
                aria-label="Refresh dashboard data"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-2 sm:gap-4 items-end h-56 pt-4">
            {dailySeries.map((day, idx) => {
              const isHovered = hoveredIdx === idx;
              if (chartMetric === 'REVENUE') {
                const fuelPct = day.fuelRevenue > 0 ? Math.max(3, Math.round((day.fuelRevenue / maxRevenue) * 100)) : 0;
                const storePct = day.storeRevenue > 0 ? Math.max(3, Math.round((day.storeRevenue / maxRevenue) * 100)) : 0;
                return (
                  <div
                    key={day.date}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="flex flex-col items-center h-full justify-end cursor-default"
                  >
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 mb-1.5 whitespace-nowrap">
                      {day.totalRevenue > 0 ? `₱${Math.round(day.totalRevenue).toLocaleString()}` : '₱0'}
                    </span>
                    <div className="w-full max-w-[44px] h-40 bg-slate-100 dark:bg-slate-800 rounded-md flex flex-col justify-end overflow-hidden p-0.5">
                      {storePct > 0 && (
                        <div
                          style={{ height: `${Math.min(100, storePct)}%` }}
                          className={`w-full rounded-t-xs transition-opacity ${
                            isHovered ? 'bg-teal-500' : 'bg-teal-600 dark:bg-teal-500'
                          }`}
                        />
                      )}
                      {fuelPct > 0 && (
                        <div
                          style={{ height: `${Math.min(100 - storePct, fuelPct)}%` }}
                          className={`w-full transition-opacity ${
                            storePct === 0 ? 'rounded-t-xs' : ''
                          } rounded-b-xs ${isHovered ? 'bg-slate-700 dark:bg-slate-300' : 'bg-slate-900 dark:bg-slate-200'}`}
                        />
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-2 whitespace-nowrap">
                      {day.label.split(',')[0]}
                    </span>
                  </div>
                );
              }

              const volPct = day.liters > 0 ? Math.max(4, Math.round((day.liters / maxLiters) * 100)) : 0;
              return (
                <div
                  key={day.date}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="flex flex-col items-center h-full justify-end cursor-default"
                >
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 mb-1.5 whitespace-nowrap">
                    {day.liters.toFixed(0)} L
                  </span>
                  <div className="w-full max-w-[44px] h-40 bg-slate-100 dark:bg-slate-800 rounded-md flex flex-col justify-end overflow-hidden p-0.5">
                    {volPct > 0 && (
                      <div
                        style={{ height: `${volPct}%` }}
                        className={`w-full rounded-xs transition-colors ${
                          isHovered ? 'bg-teal-500' : 'bg-teal-700 dark:bg-teal-500'
                        }`}
                      />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-2 whitespace-nowrap">
                    {day.label.split(',')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Revenue Mix & Payment Channels */}
        <section className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-200 dark:border-slate-800">
              7-Day Revenue Mix
            </h3>
            <div className="mt-4 space-y-3">
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div style={{ width: `${fuelPctShare}%` }} className="bg-slate-900 dark:bg-slate-200 h-full" />
                <div style={{ width: `${storePctShare}%` }} className="bg-teal-600 dark:bg-teal-500 h-full" />
              </div>
              <div className="flex justify-between text-xs">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Fuel Sales ({fuelPctShare}%)</p>
                  <p className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {formatPeso(kpis.weeklyFuelRevenue)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 dark:text-slate-400">Store Sales ({storePctShare}%)</p>
                  <p className="font-mono font-semibold text-teal-700 dark:text-teal-400 mt-0.5">
                    {formatPeso(kpis.weeklyStoreRevenue)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-200 dark:border-slate-800">
              Payment Channels (7 Days)
            </h3>
            <div className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Cash</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {formatPeso(paymentBreakdown?.cash ?? 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Card</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {formatPeso(paymentBreakdown?.card ?? 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600 dark:text-slate-400">GCash</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {formatPeso(paymentBreakdown?.gcash ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Top Selling Items Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-200 dark:border-slate-800">
            Top-Selling Fuel Grades (7 Days)
          </h3>
          {topFuel.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">No fuel sales recorded in the past 7 days.</p>
          ) : (
            <table className="w-full text-xs mt-2">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-2.5 text-left font-medium">Fuel Grade</th>
                  <th className="py-2.5 text-right font-medium">Volume Dispensed</th>
                  <th className="py-2.5 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {topFuel.map((row) => (
                  <tr key={row.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                    <td className="py-3 text-right font-mono text-slate-600 dark:text-slate-400">{formatLiters(row.quantity)}</td>
                    <td className="py-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {formatPeso(row.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-200 dark:border-slate-800">
            Top-Selling Convenience Store Items (7 Days)
          </h3>
          {topStore.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">No store item sales recorded in the past 7 days.</p>
          ) : (
            <table className="w-full text-xs mt-2">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-2.5 text-left font-medium">Item</th>
                  <th className="py-2.5 text-right font-medium">Units Sold</th>
                  <th className="py-2.5 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {topStore.map((row) => (
                  <tr key={row.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                    <td className="py-3 text-right font-mono text-slate-600 dark:text-slate-400">{row.quantity} pc</td>
                    <td className="py-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {formatPeso(row.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
      {/* Multi-Station Comparison Breakdown (Admin only) */}
      {stationBreakdown && stationBreakdown.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Station-by-Station Performance (7 Days)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click any station row to isolate its revenue, fuel volume, and top-selling items above
              </p>
            </div>
            {stationFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setStationFilter('all')}
                className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
              >
                Show All Stations
              </button>
            )}
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-2.5 px-2 text-left font-medium">Station</th>
                  <th className="py-2.5 px-2 text-left font-medium">Brand</th>
                  <th className="py-2.5 px-2 text-right font-medium">Today</th>
                  <th className="py-2.5 px-2 text-right font-medium">7-Day Revenue</th>
                  <th className="py-2.5 px-2 text-right font-medium">Volume (L)</th>
                  <th className="py-2.5 px-2 text-right font-medium">Txns</th>
                  <th className="py-2.5 px-2 text-right font-medium">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stationBreakdown.map((st) => {
                  const isFocused = stationFilter === String(st.stationId);
                  return (
                    <tr
                      key={st.stationId}
                      onClick={() => setStationFilter(isFocused ? 'all' : String(st.stationId))}
                      className={`cursor-pointer transition-colors ${
                        isFocused
                          ? 'bg-teal-50/70 dark:bg-teal-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-3 px-2 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <span className="font-mono text-slate-500 dark:text-slate-400 mr-2">{st.code}</span>
                        {st.name}
                      </td>
                      <td className="py-3 px-2 text-slate-600 dark:text-slate-400">{st.brand}</td>
                      <td className="py-3 px-2 text-right font-mono text-slate-900 dark:text-slate-100">
                        {formatPeso(st.todayRevenue)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatPeso(st.weeklyRevenue)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatLiters(st.weeklyLiters)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                        {st.transactions}
                      </td>
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        {st.outOfGasCount > 0 ? (
                          <span className="font-medium text-red-700 dark:text-red-400">
                            {st.outOfGasCount} Out of Gas
                          </span>
                        ) : st.lowStockCount > 0 ? (
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            {st.lowStockCount} Low Alert
                          </span>
                        ) : (
                          <span className="font-medium text-teal-700 dark:text-teal-400">Nominal</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
