import React, { useEffect, useState } from 'react';
import { Download, Printer, Search } from 'lucide-react';
import { api } from '../lib/api';
import { formatDateTime, formatLiters, formatPeso } from '../lib/format';
import type { AuthUser, Sale, ZReading, ZReadingPreview } from '../lib/types';
import { ReceiptModal, ZReadingModal } from './ReceiptModal';

interface SalesAndZReadingViewProps {
  currentUser: AuthUser;
}

export function SalesAndZReadingView({ currentUser }: SalesAndZReadingViewProps) {
  const canManage = currentUser.role === 'MANAGER';
  const [subTab, setSubTab] = useState<'SALES' | 'Z_READING'>('SALES');

  // Sales log state
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'VOIDED'>('ALL');
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Z-Reading state
  const [preview, setPreview] = useState<ZReadingPreview | null>(null);
  const [zHistory, setZHistory] = useState<ZReading[]>([]);
  const [zLoading, setZLoading] = useState(false);
  const [actualCashInput, setActualCashInput] = useState('');
  const [zNotes, setZNotes] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [closingZ, setClosingZ] = useState(false);
  const [zError, setZError] = useState<string | null>(null);
  const [selectedZ, setSelectedZ] = useState<ZReading | null>(null);

  const loadSales = async (searchOverride?: string) => {
    setSalesLoading(true);
    try {
      const q = searchOverride !== undefined ? searchOverride : search;
      const res = await api.listSales({
        onlyOpen,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        date: dateFilter || undefined,
        search: q.trim() || undefined,
      });
      setSales(res.sales);
      setSalesError(null);
    } catch (err) {
      setSalesError(err instanceof Error ? err.message : 'Failed to load sales log.');
    } finally {
      setSalesLoading(false);
    }
  };

  const loadZReadingData = async () => {
    if (!canManage) return;
    setZLoading(true);
    try {
      const [prevRes, histRes] = await Promise.all([api.getZReadingPreview(), api.listZReadings()]);
      setPreview(prevRes.preview);
      setActualCashInput(prevRes.preview.cashTotal.toFixed(2));
      setZHistory(histRes.zReadings);
      setZError(null);
    } catch (err) {
      setZError(err instanceof Error ? err.message : 'Failed to load Z-reading data.');
    } finally {
      setZLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadSales();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [onlyOpen, statusFilter, dateFilter, search]);

  useEffect(() => {
    if (subTab === 'Z_READING' && canManage) {
      loadZReadingData();
    }
  }, [subTab]);

  const handleExportCsv = () => {
    if (sales.length === 0) return;
    const headers = ['Receipt No', 'Timestamp', 'Cashier', 'Pump', 'Payment', 'VATable', 'VAT', 'Total', 'Status', 'Items'];
    const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = sales.map((s) => {
      const itemsText = (s.items || [])
        .map((i) => (i.itemType === 'FUEL' ? `${i.itemName} ${Number(i.quantity).toFixed(3)}L` : `${i.itemName} x${i.quantity}`))
        .join(' | ');
      return [
        s.receiptNo,
        formatDateTime(s.createdAt),
        s.cashierName,
        s.pumpLabel,
        s.paymentMethod,
        s.subtotal.toFixed(2),
        s.vatAmount.toFixed(2),
        s.totalAmount.toFixed(2),
        s.status,
        itemsText,
      ]
        .map(escapeCsv)
        .join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `petrodesk-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleConfirmVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await api.voidSale(voidTarget.id);
      setVoidTarget(null);
      await loadSales();
    } catch (err) {
      setSalesError(err instanceof Error ? err.message : 'Failed to void transaction.');
      setVoidTarget(null);
    } finally {
      setVoiding(false);
    }
  };

  const handleCloseZReading = async () => {
    if (!preview || preview.openSaleIds.length === 0) return;
    setClosingZ(true);
    setZError(null);
    try {
      const actualCash = parseFloat(actualCashInput);
      const res = await api.closeZReading({
        actualCashCount: Number.isFinite(actualCash) ? actualCash : preview.cashTotal,
        notes: zNotes,
      });
      setConfirmClose(false);
      setZNotes('');
      setSelectedZ(res.zReading);
      await Promise.all([loadZReadingData(), loadSales()]);
    } catch (err) {
      setZError(err instanceof Error ? err.message : 'Failed to finalize Z-reading.');
      setConfirmClose(false);
    } finally {
      setClosingZ(false);
    }
  };

  const cashCountNumeric = parseFloat(actualCashInput);
  const cashVariance =
    preview && Number.isFinite(cashCountNumeric)
      ? Math.round((cashCountNumeric - preview.cashTotal) * 100) / 100
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setSubTab('SALES')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              subTab === 'SALES' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Daily Sales Log
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setSubTab('Z_READING')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                subTab === 'Z_READING' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Z-Reading &amp; Closing
            </button>
          )}
        </div>

        {subTab === 'SALES' && (
          <button
            type="button"
            disabled={sales.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {subTab === 'SALES' && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Transaction Ledger</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect shift receipts, reprint customer copies, or manage open transactions
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="OR #, cashier, pump..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <input
                type="date"
                aria-label="Filter by date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                >
                  Clear Date
                </button>
              )}

              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                {(['ALL', 'COMPLETED', 'VOIDED'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      statusFilter === st ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st === 'COMPLETED' ? 'Completed' : 'Voided'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setOnlyOpen((v) => !v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  onlyOpen
                    ? 'bg-slate-900 dark:bg-teal-600 text-white border-slate-900 dark:border-teal-500'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Open Shift Only
              </button>
            </div>
          </div>

          {salesError && (
            <div className="mt-4 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg">
              {salesError}
            </div>
          )}

          {salesLoading ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">Loading sales ledger...</div>
          ) : sales.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              No transactions match the selected filters.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-2 text-left font-medium">Receipt #</th>
                    <th className="py-2.5 px-2 text-left font-medium">Timestamp</th>
                    <th className="py-2.5 px-2 text-left font-medium">Cashier · Pump</th>
                    <th className="py-2.5 px-2 text-left font-medium">Items</th>
                    <th className="py-2.5 px-2 text-left font-medium">Payment</th>
                    <th className="py-2.5 px-2 text-right font-medium">Total</th>
                    <th className="py-2.5 px-2 text-left font-medium">State</th>
                    <th className="py-2.5 px-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sales.map((sale) => {
                    const summary = (sale.items || [])
                      .map((i) =>
                        i.itemType === 'FUEL'
                          ? `${i.itemName} (${Number(i.quantity).toFixed(2)} L)`
                          : `${i.itemName} ×${i.quantity}`
                      )
                      .join(', ');
                    return (
                      <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-2 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {sale.receiptNo}
                        </td>
                        <td className="py-3 px-2 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(sale.createdAt)}
                        </td>
                        <td className="py-3 px-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <span>{sale.cashierName}</span>
                          <span aria-hidden="true" className="mx-1.5 text-slate-400 dark:text-slate-600">·</span>
                          <span className="text-slate-500 dark:text-slate-400">{sale.pumpLabel}</span>
                        </td>
                        <td className="py-3 px-2 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={summary}>
                          {summary}
                        </td>
                        <td className="py-3 px-2 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {sale.paymentMethod}
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatPeso(sale.totalAmount)}
                        </td>
                        <td className="py-3 px-2 whitespace-nowrap">
                          <span
                            className={`font-medium ${
                              sale.status === 'VOIDED'
                                ? 'text-red-700 dark:text-red-400'
                                : sale.zReadingId !== null
                                ? 'text-slate-500 dark:text-slate-400'
                                : 'text-teal-700 dark:text-teal-400'
                            }`}
                          >
                            {sale.status === 'VOIDED'
                              ? 'Voided'
                              : sale.zReadingId !== null
                              ? 'Closed'
                              : 'Open Shift'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(sale)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Receipt</span>
                          </button>
                          {canManage && sale.status === 'COMPLETED' && sale.zReadingId === null && (
                            <button
                              type="button"
                              onClick={() => setVoidTarget(sale)}
                              className="px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-800 rounded transition-colors"
                            >
                              Void
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {subTab === 'Z_READING' && canManage && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">1. Open Shift Summary (X-Reading)</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Accumulated unclosed transactions since the last Z-Reading
                  </p>
                </div>
                {preview && (
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {preview.transactionCount} completed · {preview.voidedCount} voided
                  </span>
                )}
              </div>

              {zLoading || !preview ? (
                <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">Calculating shift totals...</div>
              ) : preview.openSaleIds.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">All transactions are closed</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    New sales recorded in the POS Terminal will accumulate here for the next Z-Reading.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Gross Revenue</p>
                      <p className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {formatPeso(preview.totalRevenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Fuel Sales</p>
                      <p className="font-mono text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
                        {formatPeso(preview.fuelRevenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Store Sales</p>
                      <p className="font-mono text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
                        {formatPeso(preview.storeRevenue)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-2">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Tender Breakdown</p>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-400">Cash Payments</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatPeso(preview.cashTotal)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-400">Card Payments</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatPeso(preview.cardTotal)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-400">GCash Payments</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatPeso(preview.gcashTotal)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-600 dark:text-slate-400">OR Sequence</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {preview.beginningOrNo} → {preview.endingOrNo}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Fuel Dispensed &amp; Tax</p>
                      {preview.fuelBreakdown.map((fb) => (
                        <div key={fb.name} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-600 dark:text-slate-400">{fb.name}</span>
                          <span className="font-mono text-slate-900 dark:text-slate-100">
                            {formatLiters(fb.liters)} · {formatPeso(fb.revenue)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-400">VATable Sales</span>
                        <span className="font-mono text-slate-900 dark:text-slate-100">{formatPeso(preview.totalVatableSales)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-600 dark:text-slate-400">12% VAT</span>
                        <span className="font-mono text-slate-900 dark:text-slate-100">{formatPeso(preview.totalVat)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 pb-4 border-b border-slate-200 dark:border-slate-800">
                2. Cash Drawer Count &amp; Close
              </h2>

              {zError && (
                <div className="mt-4 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg">
                  {zError}
                </div>
              )}

              <div className="mt-4 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Expected Cash in Drawer</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {formatPeso(preview?.cashTotal ?? 0)}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="actual-cash" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Actual Cash Counted (₱)
                    </label>
                    {preview && preview.openSaleIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActualCashInput(preview.cashTotal.toFixed(2))}
                        className="text-[11px] font-medium text-teal-700 dark:text-teal-400 hover:underline"
                      >
                        Match Expected
                      </button>
                    )}
                  </div>
                  <input
                    id="actual-cash"
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!preview || preview.openSaleIds.length === 0}
                    value={actualCashInput}
                    onChange={(e) => setActualCashInput(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono font-semibold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Cash Over / Short Variance</span>
                  <span
                    className={`font-mono font-bold ${
                      cashVariance === 0 ? 'text-teal-700 dark:text-teal-400' : cashVariance > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {cashVariance > 0 ? `+${formatPeso(cashVariance)}` : formatPeso(cashVariance)}
                  </span>
                </div>

                <div>
                  <label htmlFor="z-notes" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Shift Closing Notes
                  </label>
                  <textarea
                    id="z-notes"
                    rows={2}
                    disabled={!preview || preview.openSaleIds.length === 0}
                    value={zNotes}
                    onChange={(e) => setZNotes(e.target.value)}
                    placeholder="Pump meter check, cash drop, or discrepancy remarks..."
                    className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <button
                  type="button"
                  disabled={!preview || preview.openSaleIds.length === 0 || closingZ}
                  onClick={() => setConfirmClose(true)}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
                >
                  Close Shift &amp; Generate Z-Reading
                </button>
              </div>
            </section>
          </div>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-200 dark:border-slate-800">
              Historical Z-Reading Archive
            </h3>

            {zHistory.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">No closed Z-readings recorded yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2.5 px-2 text-left font-medium">Z-Reading #</th>
                      <th className="py-2.5 px-2 text-left font-medium">Closed At</th>
                      <th className="py-2.5 px-2 text-left font-medium">Closed By</th>
                      <th className="py-2.5 px-2 text-right font-medium">Txns</th>
                      <th className="py-2.5 px-2 text-right font-medium">Fuel Vol</th>
                      <th className="py-2.5 px-2 text-right font-medium">Gross Revenue</th>
                      <th className="py-2.5 px-2 text-right font-medium">Variance</th>
                      <th className="py-2.5 px-2 text-right font-medium">Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {zHistory.map((z) => (
                      <tr key={z.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-2 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {z.readingNumber}
                        </td>
                        <td className="py-3 px-2 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(z.createdAt)}
                        </td>
                        <td className="py-3 px-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">{z.closedByName}</td>
                        <td className="py-3 px-2 text-right font-mono text-slate-700 dark:text-slate-300">{z.transactionCount}</td>
                        <td className="py-3 px-2 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatLiters(z.totalFuelLiters)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {formatPeso(z.totalRevenue)}
                        </td>
                        <td
                          className={`py-3 px-2 text-right font-mono font-medium ${
                            z.cashVariance === 0 ? 'text-teal-700 dark:text-teal-400' : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {formatPeso(z.cashVariance)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedZ(z)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors whitespace-nowrap"
                          >
                            <Printer className="w-3 h-3" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {voidTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Void Transaction {voidTarget.receiptNo}?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Voiding this receipt ({formatPeso(voidTarget.totalAmount)}) will automatically restore deducted fuel liters
              and convenience store stock back to inventory.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={voiding}
                onClick={() => setVoidTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={voiding}
                onClick={handleConfirmVoid}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                {voiding ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmClose && preview && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Finalize Z-Reading?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This will permanently close <span className="font-mono font-semibold">{preview.openSaleIds.length}</span>{' '}
              open shift transactions totaling{' '}
              <span className="font-mono font-semibold">{formatPeso(preview.totalRevenue)}</span>. Closed sales can no
              longer be voided.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={closingZ}
                onClick={() => setConfirmClose(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={closingZ}
                onClick={handleCloseZReading}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                {closingZ ? 'Closing Shift...' : 'Confirm & Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReceiptModal sale={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      <ZReadingModal zReading={selectedZ} onClose={() => setSelectedZ(null)} />
    </div>
  );
}
