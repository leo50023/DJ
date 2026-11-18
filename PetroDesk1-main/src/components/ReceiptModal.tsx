import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, ExternalLink, Printer, X } from 'lucide-react';
import { formatDateTime, formatPeso } from '../lib/format';
import type { Sale, ZReading } from '../lib/types';

function buildFullHtmlDocument(title: string, bodyHtml: string, autoPrint = false): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { margin: 8mm; size: 80mm auto; }
    * { box-sizing: border-box; }
    body {
      margin: 20px auto;
      padding: 16px;
      font-family: "Courier New", Courier, monospace;
      font-size: 12px;
      line-height: 1.45;
      color: #0f172a;
      background: #ffffff;
      max-width: 340px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .muted { color: #475569; font-size: 11px; }
    .divider { border-top: 1px dashed #94a3b8; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .item { margin-bottom: 6px; }
    .void-box { border: 1px solid #b91c1c; color: #b91c1c; padding: 3px 6px; font-weight: 700; margin-top: 6px; display: inline-block; }
    .total-row { font-size: 14px; font-weight: 700; padding-top: 4px; }
    .toolbar { margin-top: 14px; text-align: center; }
    .btn { padding: 8px 14px; background: #0f766e; color: #ffffff; border: 0; border-radius: 6px; font-family: sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; }
    @media print {
      body { border: none; margin: 0 auto; padding: 8px 0; }
      .toolbar { display: none; }
    }
  </style>
</head>
<body>
  ${bodyHtml}
  <div class="toolbar">
    <button class="btn" onclick="window.print()">Print Receipt</button>
  </div>
  ${autoPrint ? '<script>window.addEventListener("load", function () { window.print(); });</script>' : ''}
</body>
</html>`;
}

function downloadHtmlFile(filename: string, title: string, bodyHtml: string) {
  const fullHtml = buildFullHtmlDocument(title, bodyHtml, false);
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatStationHeader(obj: { stationBrand?: string; stationName?: string }) {
  const brand = (obj.stationBrand || 'PETRODESK').trim().toUpperCase();
  const name = (obj.stationName || 'STATION').trim().toUpperCase();
  return brand === name ? brand : `${brand} · ${name}`;
}

function buildSalePrintHtml(sale: Sale): string {
  const itemsHtml = (sale.items || [])
    .map((item) => {
      const sub =
        item.itemType === 'FUEL'
          ? `${Number(item.quantity).toFixed(3)} L x ${formatPeso(item.unitPrice)}/L`
          : `${item.quantity} ${item.unit} x ${formatPeso(item.unitPrice)}`;
      return `<div class="item">
        <div class="row bold"><span>${item.itemName}</span><span>${formatPeso(item.lineTotal)}</span></div>
        <div class="muted">${sub}</div>
      </div>`;
    })
    .join('');

  return `
    <div class="center">
      <div class="bold" style="font-size:14px;">${formatStationHeader(sale)}</div>
      <div class="muted">${sale.stationAddress || 'National Highway'}</div>
      <div class="muted">VAT REG TIN ${sale.stationTin || '009-482-110-000'}</div>
      ${sale.status === 'VOIDED' ? '<div class="void-box">VOIDED TRANSACTION</div>' : ''}
    </div>
    <div class="divider"></div>
    <div class="muted">
      <div class="row"><span>OR Number</span><span class="bold">${sale.receiptNo}</span></div>
      <div class="row"><span>Date / Time</span><span>${formatDateTime(sale.createdAt)}</span></div>
      <div class="row"><span>Cashier</span><span>${sale.cashierName}</span></div>
      <div class="row"><span>Pump / Point</span><span>${sale.pumpLabel}</span></div>
    </div>
    <div class="divider"></div>
    ${itemsHtml}
    <div class="divider"></div>
    <div class="muted">
      <div class="row"><span>VATable Sales</span><span>${formatPeso(sale.subtotal)}</span></div>
      <div class="row"><span>12% VAT</span><span>${formatPeso(sale.vatAmount)}</span></div>
      <div class="row total-row"><span>TOTAL DUE</span><span>${formatPeso(sale.totalAmount)}</span></div>
    </div>
    <div class="divider"></div>
    <div class="muted">
      <div class="row"><span>Payment (${sale.paymentMethod})</span><span>${formatPeso(sale.amountTendered)}</span></div>
      <div class="row"><span>Change</span><span>${formatPeso(sale.changeAmount)}</span></div>
    </div>
    <div class="divider"></div>
    <div class="center muted">
      <div>This serves as your Official Receipt.</div>
      <div>Drive safely. Thank you for fueling with us.</div>
    </div>`;
}

function buildSalePlainText(sale: Sale): string {
  const lines = [
    formatStationHeader(sale),
    sale.stationAddress || 'National Highway',
    `OR#: ${sale.receiptNo} (${sale.status})`,
    `Date: ${formatDateTime(sale.createdAt)}`,
    `Cashier: ${sale.cashierName} | ${sale.pumpLabel}`,
    '--------------------------------',
    ...(sale.items || []).map((i) =>
      i.itemType === 'FUEL'
        ? `${i.itemName} (${Number(i.quantity).toFixed(3)} L x ${formatPeso(i.unitPrice)}/L) = ${formatPeso(i.lineTotal)}`
        : `${i.itemName} (${i.quantity} ${i.unit} x ${formatPeso(i.unitPrice)}) = ${formatPeso(i.lineTotal)}`
    ),
    '--------------------------------',
    `VATable Sales: ${formatPeso(sale.subtotal)}`,
    `12% VAT:       ${formatPeso(sale.vatAmount)}`,
    `TOTAL DUE:     ${formatPeso(sale.totalAmount)}`,
    `Paid (${sale.paymentMethod}): ${formatPeso(sale.amountTendered)}`,
    `Change:        ${formatPeso(sale.changeAmount)}`,
  ];
  return lines.join('\n');
}

function buildZPrintHtml(z: ZReading): string {
  return `
    <div class="center">
      <div class="bold" style="font-size:14px;">Z-READING REPORT</div>
      <div class="muted">${formatStationHeader(z)}</div>
      ${z.stationAddress ? `<div class="muted">${z.stationAddress}</div>` : ''}
      <div class="bold" style="margin-top:4px;">${z.readingNumber}</div>
    </div>
    <div class="divider"></div>
    <div class="muted">
      <div class="row"><span>Closed By</span><span>${z.closedByName}</span></div>
      <div class="row"><span>Period Start</span><span>${formatDateTime(z.periodStart)}</span></div>
      <div class="row"><span>Period End</span><span>${formatDateTime(z.periodEnd)}</span></div>
      <div class="row"><span>Beginning OR</span><span>${z.beginningOrNo}</span></div>
      <div class="row"><span>Ending OR</span><span>${z.endingOrNo}</span></div>
    </div>
    <div class="divider"></div>
    <div class="muted">
      <div class="row"><span>Completed Txns</span><span>${z.transactionCount}</span></div>
      <div class="row"><span>Voided Txns</span><span>${z.voidedCount}</span></div>
      <div class="row"><span>Total Fuel Vol</span><span>${Number(z.totalFuelLiters).toFixed(2)} L</span></div>
    </div>
    <div class="divider"></div>
    <div class="muted">
      <div class="row"><span>Fuel Sales</span><span>${formatPeso(z.fuelRevenue)}</span></div>
      <div class="row"><span>Store Sales</span><span>${formatPeso(z.storeRevenue)}</span></div>
      <div class="row"><span>VATable Sales</span><span>${formatPeso(z.totalVatableSales)}</span></div>
      <div class="row"><span>12% VAT</span><span>${formatPeso(z.totalVat)}</span></div>
      <div class="row total-row"><span>GROSS REVENUE</span><span>${formatPeso(z.totalRevenue)}</span></div>
    </div>
    <div class="divider"></div>
    <div class="muted">
      <div class="row"><span>Expected Cash</span><span>${formatPeso(z.cashTotal)}</span></div>
      <div class="row"><span>Card Payments</span><span>${formatPeso(z.cardTotal)}</span></div>
      <div class="row"><span>GCash Payments</span><span>${formatPeso(z.gcashTotal)}</span></div>
      <div class="row bold"><span>Actual Cash</span><span>${formatPeso(z.actualCashCount)}</span></div>
      <div class="row bold"><span>Cash Variance</span><span>${formatPeso(z.cashVariance)}</span></div>
    </div>
    ${z.notes ? `<div class="divider"></div><div class="muted"><span class="bold">Notes:</span> ${z.notes}</div>` : ''}`;
}

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export function ReceiptModal({ sale, onClose }: ReceiptModalProps) {
  const [copied, setCopied] = useState(false);
  const [printNote, setPrintNote] = useState<string | null>(null);
  const [standaloneUrl, setStandaloneUrl] = useState<string>('');
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;

  useEffect(() => {
    if (!sale) {
      setStandaloneUrl('');
      return;
    }
    const html = buildFullHtmlDocument(`Receipt ${sale.receiptNo}`, buildSalePrintHtml(sale), true);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    setStandaloneUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sale]);

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
    if (isEmbedded) {
      setPrintNote(
        'If your browser blocked printing inside this preview frame, use "Open to Print" or "Save Copy".'
      );
    }
  };

  const handleDownload = () => {
    downloadHtmlFile(`${sale.receiptNo}.html`, `Receipt ${sale.receiptNo}`, buildSalePrintHtml(sale));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildSalePlainText(sale));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setPrintNote('Clipboard access is unavailable in this browser.');
    }
  };

  return createPortal(
    <div className="print-portal fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
      <div className="print-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md overflow-hidden">
        <div className="no-print flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Digital Receipt Preview</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt preview"
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="print-scroll-body p-5 bg-slate-50 dark:bg-slate-950 max-h-[65vh] overflow-y-auto">
          <div
            id="printable-receipt"
            className="bg-white border border-slate-200 rounded-lg p-5 font-mono text-xs text-slate-900 space-y-3 max-w-[340px] mx-auto"
          >
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <p className="text-sm font-bold tracking-tight">{formatStationHeader(sale)}</p>
              <p className="text-[11px] text-slate-600">{sale.stationAddress || 'National Highway'}</p>
              <p className="text-[11px] text-slate-600">VAT REG TIN {sale.stationTin || '009-482-110-000'}</p>
              {sale.status === 'VOIDED' && (
                <p className="mt-1.5 font-bold text-red-700 border border-red-300 py-0.5">
                  VOIDED TRANSACTION
                </p>
              )}
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500">OR Number</span>
                <span className="font-semibold">{sale.receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date / Time</span>
                <span>{formatDateTime(sale.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cashier</span>
                <span>{sale.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pump / Point</span>
                <span>{sale.pumpLabel}</span>
              </div>
            </div>

            <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
              {(sale.items || []).map((item) => (
                <div key={item.id} className="space-y-0.5">
                  <div className="flex justify-between font-semibold">
                    <span>{item.itemName}</span>
                    <span>{formatPeso(item.lineTotal)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {item.itemType === 'FUEL'
                      ? `${Number(item.quantity).toFixed(3)} L × ${formatPeso(item.unitPrice)}/L`
                      : `${item.quantity} ${item.unit} × ${formatPeso(item.unitPrice)}`}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500">VATable Sales</span>
                <span>{formatPeso(sale.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">12% VAT</span>
                <span>{formatPeso(sale.vatAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1 text-slate-900">
                <span>TOTAL DUE</span>
                <span>{formatPeso(sale.totalAmount)}</span>
              </div>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Payment ({sale.paymentMethod})</span>
                <span>{formatPeso(sale.amountTendered)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Change</span>
                <span>{formatPeso(sale.changeAmount)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-dashed border-slate-300 text-center text-[11px] text-slate-500">
              <p>This serves as your Official Receipt.</p>
              <p>Drive safely. Thank you for fueling with us.</p>
            </div>
          </div>

          {printNote && (
            <p className="no-print text-[11px] text-center text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mt-3">
              {printNote}
            </p>
          )}
        </div>

        <div className="no-print flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Copy</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {isEmbedded && standaloneUrl && (
              <a
                href={standaloneUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open to Print</span>
              </a>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ZReadingModalProps {
  zReading: ZReading | null;
  onClose: () => void;
}

export function ZReadingModal({ zReading, onClose }: ZReadingModalProps) {
  const [printNote, setPrintNote] = useState<string | null>(null);
  const [standaloneUrl, setStandaloneUrl] = useState<string>('');
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;

  useEffect(() => {
    if (!zReading) {
      setStandaloneUrl('');
      return;
    }
    const html = buildFullHtmlDocument(`Z-Reading ${zReading.readingNumber}`, buildZPrintHtml(zReading), true);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    setStandaloneUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [zReading]);

  if (!zReading) return null;

  const handlePrint = () => {
    window.print();
    if (isEmbedded) {
      setPrintNote(
        'If your browser blocked printing inside this preview frame, use "Open to Print" or "Save Copy".'
      );
    }
  };

  const handleDownload = () => {
    downloadHtmlFile(
      `${zReading.readingNumber}.html`,
      `Z-Reading ${zReading.readingNumber}`,
      buildZPrintHtml(zReading)
    );
  };

  return createPortal(
    <div className="print-portal fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
      <div className="print-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md overflow-hidden">
        <div className="no-print flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Z-Reading End-of-Day Report</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Z-Reading report"
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="print-scroll-body p-5 bg-slate-50 dark:bg-slate-950 max-h-[65vh] overflow-y-auto">
          <div
            id="printable-receipt"
            className="bg-white border border-slate-200 rounded-lg p-5 font-mono text-xs text-slate-900 space-y-3 max-w-[340px] mx-auto"
          >
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <p className="text-sm font-bold">Z-READING REPORT</p>
              <p className="text-[11px] text-slate-600">{formatStationHeader(zReading)}</p>
              {zReading.stationAddress && <p className="text-[11px] text-slate-600">{zReading.stationAddress}</p>}
              <p className="text-[11px] font-semibold mt-1">{zReading.readingNumber}</p>
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Closed By</span>
                <span>{zReading.closedByName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Period Start</span>
                <span>{formatDateTime(zReading.periodStart)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Period End</span>
                <span>{formatDateTime(zReading.periodEnd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Beginning OR</span>
                <span>{zReading.beginningOrNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ending OR</span>
                <span>{zReading.endingOrNo}</span>
              </div>
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Completed Txns</span>
                <span>{zReading.transactionCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Voided Txns</span>
                <span>{zReading.voidedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Fuel Volume</span>
                <span>{Number(zReading.totalFuelLiters).toFixed(2)} L</span>
              </div>
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Fuel Sales</span>
                <span>{formatPeso(zReading.fuelRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Store Sales</span>
                <span>{formatPeso(zReading.storeRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">VATable Sales</span>
                <span>{formatPeso(zReading.totalVatableSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">12% VAT</span>
                <span>{formatPeso(zReading.totalVat)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1">
                <span>GROSS REVENUE</span>
                <span>{formatPeso(zReading.totalRevenue)}</span>
              </div>
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Expected Cash</span>
                <span>{formatPeso(zReading.cashTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Card Payments</span>
                <span>{formatPeso(zReading.cardTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GCash Payments</span>
                <span>{formatPeso(zReading.gcashTotal)}</span>
              </div>
              <div className="flex justify-between pt-1 font-semibold">
                <span>Actual Cash Count</span>
                <span>{formatPeso(zReading.actualCashCount)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Cash Variance</span>
                <span>{formatPeso(zReading.cashVariance)}</span>
              </div>
            </div>

            {zReading.notes && (
              <div className="text-[11px] text-slate-600">
                <span className="font-semibold text-slate-800">Notes: </span>
                {zReading.notes}
              </div>
            )}
          </div>

          {printNote && (
            <p className="no-print text-[11px] text-center text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mt-3">
              {printNote}
            </p>
          )}
        </div>

        <div className="no-print flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save Copy</span>
          </button>

          <div className="flex items-center gap-1.5">
            {isEmbedded && standaloneUrl && (
              <a
                href={standaloneUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open to Print</span>
              </a>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Z-Reading</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
