import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { formatLiters, formatPeso } from '../lib/format';
import type { FuelTank, PaymentMethod, Sale, StoreItem } from '../lib/types';
import { ReceiptModal } from './ReceiptModal';

interface CartLine {
  key: string;
  itemType: 'FUEL' | 'STORE';
  fuelTankId?: number;
  storeItemId?: number;
  name: string;
  inputMode?: 'LITERS' | 'PESOS';
  amount?: number;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

const PUMP_OPTIONS = [
  { id: 'Island 1 · Pump A', short: 'Pump 1A' },
  { id: 'Island 1 · Pump B', short: 'Pump 1B' },
  { id: 'Island 2 · Pump A', short: 'Pump 2A' },
  { id: 'Island 2 · Pump B', short: 'Pump 2B' },
  { id: 'Counter Only', short: 'Counter' },
];

export function PosTerminal() {
  const [tanks, setTanks] = useState<FuelTank[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fuel input state
  const [selectedTankId, setSelectedTankId] = useState<number | null>(null);
  const [fuelMode, setFuelMode] = useState<'PESOS' | 'LITERS'>('PESOS');
  const [fuelAmountInput, setFuelAmountInput] = useState<string>('500');
  const [pumpLabel, setPumpLabel] = useState<string>(PUMP_OPTIONS[0].id);

  // Store catalog filter
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Cart & Checkout
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [tenderedInput, setTenderedInput] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [pendingRemove, setPendingRemove] = useState<
    { type: 'LINE'; line: CartLine } | { type: 'CLEAR' } | null
  >(null);
  const ticketRef = useRef<HTMLElement | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    window.setTimeout(() => {
      setFeedbackMsg((curr) => (curr === msg ? null : curr));
    }, 2800);
  };

  const loadCatalog = async () => {
    try {
      const data = await api.getCatalog();
      setTanks(data.tanks);
      setStoreItems(data.storeItems);
      if (data.tanks.length > 0 && selectedTankId === null) {
        setSelectedTankId(data.tanks[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load POS catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const selectedTank = useMemo(
    () => tanks.find((t) => t.id === selectedTankId) || tanks[0] || null,
    [tanks, selectedTankId]
  );

  const fuelCalc = useMemo(() => {
    if (!selectedTank) return { liters: 0, pesos: 0 };
    const val = parseFloat(fuelAmountInput);
    if (!Number.isFinite(val) || val <= 0) return { liters: 0, pesos: 0 };
    if (fuelMode === 'PESOS') {
      const pesos = Math.round(val * 100) / 100;
      const liters = Math.round((pesos / selectedTank.pricePerLiter) * 1000) / 1000;
      return { liters, pesos };
    }
    const liters = Math.round(val * 1000) / 1000;
    const pesos = Math.round(liters * selectedTank.pricePerLiter * 100) / 100;
    return { liters, pesos };
  }, [selectedTank, fuelAmountInput, fuelMode]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    storeItems.forEach((s) => set.add(s.category));
    return ['ALL', ...Array.from(set)];
  }, [storeItems]);

  const filteredStore = useMemo(() => {
    const q = search.trim().toLowerCase();
    return storeItems.filter((item) => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
    });
  }, [storeItems, search, categoryFilter]);

  const cartQtyByStoreId = useMemo(() => {
    const map = new Map<number, number>();
    for (const line of cart) {
      if (line.itemType === 'STORE' && line.storeItemId) {
        map.set(line.storeItemId, (map.get(line.storeItemId) || 0) + line.quantity);
      }
    }
    return map;
  }, [cart]);

  const cartLitersByTankId = useMemo(() => {
    const map = new Map<number, number>();
    for (const line of cart) {
      if (line.itemType === 'FUEL' && line.fuelTankId) {
        map.set(line.fuelTankId, Math.round(((map.get(line.fuelTankId) || 0) + line.quantity) * 1000) / 1000);
      }
    }
    return map;
  }, [cart]);

  const orderTotal = useMemo(
    () => Math.round(cart.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100,
    [cart]
  );
  const vatableSales = Math.round((orderTotal / 1.12) * 100) / 100;
  const vatAmount = Math.round((orderTotal - vatableSales) * 100) / 100;

  const smartCashSuggestions = useMemo(() => {
    if (orderTotal <= 0) return [500, 1000, 2000];
    const candidates = new Set<number>();
    const next100 = Math.ceil(orderTotal / 100) * 100;
    const next500 = Math.ceil(orderTotal / 500) * 500;
    const next1000 = Math.ceil(orderTotal / 1000) * 1000;
    [next100, next500, next1000, 1000, 2000].forEach((amt) => {
      if (amt >= orderTotal) candidates.add(amt);
    });
    return Array.from(candidates).sort((a, b) => a - b).slice(0, 3);
  }, [orderTotal]);

  const tenderedNumeric = paymentMethod === 'CASH' ? parseFloat(tenderedInput) || 0 : orderTotal;
  const cashShortBy =
    paymentMethod === 'CASH' && orderTotal > 0 && tenderedInput !== '' && tenderedNumeric < orderTotal
      ? Math.round((orderTotal - tenderedNumeric) * 100) / 100
      : 0;
  const changeDue =
    paymentMethod === 'CASH' && tenderedNumeric >= orderTotal
      ? Math.round((tenderedNumeric - orderTotal) * 100) / 100
      : 0;

  const handleAddFuel = () => {
    setCheckoutError(null);
    if (!selectedTank || fuelCalc.liters <= 0 || fuelCalc.pesos <= 0) return;

    const inCartLiters = cartLitersByTankId.get(selectedTank.id) || 0;
    const availableLiters = Math.max(0, Math.round((selectedTank.currentLiters - inCartLiters) * 1000) / 1000);
    if (fuelCalc.liters > availableLiters) {
      setCheckoutError(
        `Insufficient ${selectedTank.name} tank volume (${formatLiters(availableLiters, 2)} remaining).`
      );
      return;
    }

    const line: CartLine = {
      key: `fuel-${selectedTank.id}-${Date.now()}`,
      itemType: 'FUEL',
      fuelTankId: selectedTank.id,
      name: selectedTank.name,
      inputMode: fuelMode,
      amount: fuelMode === 'PESOS' ? fuelCalc.pesos : fuelCalc.liters,
      quantity: fuelCalc.liters,
      unit: 'L',
      unitPrice: selectedTank.pricePerLiter,
      lineTotal: fuelCalc.pesos,
    };

    setCart((prev) => [...prev, line]);
    showFeedback(`Added ${fuelCalc.liters.toFixed(2)} L ${selectedTank.name} (${formatPeso(fuelCalc.pesos)})`);
  };

  const handleAddStoreItem = (item: StoreItem) => {
    setCheckoutError(null);
    if (item.stockQty <= 0) return;

    let added = false;
    setCart((prev) => {
      const existing = prev.find((l) => l.itemType === 'STORE' && l.storeItemId === item.id);
      if (existing) {
        if (existing.quantity + 1 > item.stockQty) {
          setCheckoutError(`Only ${item.stockQty} units of ${item.name} in stock.`);
          return prev;
        }
        added = true;
        return prev.map((l) =>
          l.key === existing.key
            ? {
                ...l,
                quantity: l.quantity + 1,
                lineTotal: Math.round((l.quantity + 1) * l.unitPrice * 100) / 100,
              }
            : l
        );
      }
      added = true;
      return [
        ...prev,
        {
          key: `store-${item.id}`,
          itemType: 'STORE',
          storeItemId: item.id,
          name: item.name,
          quantity: 1,
          unit: 'pc',
          unitPrice: item.unitPrice,
          lineTotal: item.unitPrice,
        },
      ];
    });
    if (added) {
      showFeedback(`Added ${item.name} to order`);
    }
  };

  const adjustStoreQty = (key: string, delta: number) => {
    setCheckoutError(null);
    const target = cart.find((line) => line.key === key && line.itemType === 'STORE');
    if (!target) return;

    const nextQty = target.quantity + delta;
    if (nextQty <= 0) {
      setPendingRemove({ type: 'LINE', line: target });
      return;
    }

    const storeObj = storeItems.find((s) => s.id === target.storeItemId);
    if (storeObj && nextQty > storeObj.stockQty) {
      setCheckoutError(`Maximum available stock for ${target.name} is ${storeObj.stockQty}.`);
      return;
    }

    setCart((prev) =>
      prev.map((line) =>
        line.key === key
          ? {
              ...line,
              quantity: nextQty,
              lineTotal: Math.round(nextQty * line.unitPrice * 100) / 100,
            }
          : line
      )
    );
  };

  const confirmRemoveAction = () => {
    if (!pendingRemove) return;
    if (pendingRemove.type === 'CLEAR') {
      setCart([]);
      setTenderedInput('');
      setCheckoutError(null);
    } else {
      setCart((prev) => prev.filter((l) => l.key !== pendingRemove.line.key));
    }
    setPendingRemove(null);
  };

  const handleCompleteSale = async () => {
    setCheckoutError(null);
    if (cart.length === 0) {
      setCheckoutError('Add fuel or convenience store items before completing the sale.');
      return;
    }
    if (paymentMethod === 'CASH' && tenderedNumeric < orderTotal) {
      setCheckoutError('Enter cash tendered equal to or greater than the total amount due.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createSale({
        lines: cart.map((l) =>
          l.itemType === 'FUEL'
            ? {
                itemType: 'FUEL',
                fuelTankId: l.fuelTankId,
                inputMode: l.inputMode,
                amount: l.amount,
              }
            : {
                itemType: 'STORE',
                storeItemId: l.storeItemId,
                quantity: l.quantity,
              }
        ),
        paymentMethod,
        pumpLabel,
        amountTendered: paymentMethod === 'CASH' ? tenderedNumeric : orderTotal,
      });

      setCompletedSale(res.sale);
      setCart([]);
      setTenderedInput('');
      showFeedback(`Receipt ${res.sale.receiptNo} recorded`);
      await loadCatalog();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Failed to complete transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const presets = fuelMode === 'PESOS' ? [200, 500, 1000, 2000] : [5, 10, 20, 40];

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 h-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
        <div className="lg:col-span-5 h-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-xl p-6 text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  return (
    <>
      {feedbackMsg && (
        <div className="mb-4 px-4 py-2.5 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 rounded-xl text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-16 lg:pb-0">
        {/* Left Entry Workspace: Fuel Entry + Store Items */}
        <div className="lg:col-span-7 space-y-6">
          {/* Fuel Dispenser Manual Entry */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">1. Select Fuel &amp; Amount</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tap fuel grade, choose pump point, and enter Pesos or Liters
                </p>
              </div>
            </div>

            {/* One-Tap Pump Selector */}
            <div className="mt-4">
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Pump / Point of Sale</span>
              <div className="flex flex-wrap gap-1.5">
                {PUMP_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPumpLabel(p.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      pumpLabel === p.id
                        ? 'bg-slate-900 dark:bg-teal-600 text-white border-slate-900 dark:border-teal-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p.short}
                  </button>
                ))}
              </div>
            </div>

            {/* Fuel Grade Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {tanks.map((tank) => {
                const isSelected = selectedTank?.id === tank.id;
                const inCartLiters = cartLitersByTankId.get(tank.id) || 0;
                const projectedLiters = Math.max(0, Math.round((tank.currentLiters - inCartLiters) * 1000) / 1000);
                const isOut = projectedLiters <= 0;
                const isLow = !isOut && projectedLiters <= tank.reorderThresholdLiters;
                return (
                  <button
                    key={tank.id}
                    type="button"
                    onClick={() => setSelectedTankId(tank.id)}
                    className={`text-left p-4 rounded-xl border transition-colors ${
                      isSelected
                        ? 'bg-slate-900 dark:bg-teal-700 text-white border-slate-900 dark:border-teal-600'
                        : 'bg-white dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={isSelected ? 'text-slate-300 dark:text-teal-100 font-mono' : 'text-slate-500 dark:text-slate-400 font-mono'}>
                        {tank.code}
                      </span>
                      {isOut ? (
                        <span className={isSelected ? 'text-red-300 font-medium' : 'text-red-700 dark:text-red-400 font-medium'}>
                          Out of Gas
                        </span>
                      ) : isLow ? (
                        <span className={isSelected ? 'text-amber-300 font-medium' : 'text-amber-700 dark:text-amber-400 font-medium'}>
                          Low Tank
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold mt-1">{tank.name}</p>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <span className="font-mono text-base font-bold">
                        {formatPeso(tank.pricePerLiter)}
                        <span className={`text-xs font-normal ${isSelected ? 'text-slate-300 dark:text-teal-100' : 'text-slate-500 dark:text-slate-400'}`}>
                          /L
                        </span>
                      </span>
                      <span className={`font-mono text-xs ${isSelected ? 'text-slate-200 dark:text-teal-50' : 'text-slate-600 dark:text-slate-300'}`}>
                        {formatLiters(projectedLiters, 2)}
                      </span>
                    </div>
                    {inCartLiters > 0 && (
                      <p className={`mt-1 text-[11px] font-mono text-right ${isSelected ? 'text-teal-300 dark:text-teal-100' : 'text-teal-700 dark:text-teal-400'}`}>
                        -{inCartLiters.toFixed(2)} L in order
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Amount Mode + Input */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4">
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Input Mode</span>
                <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setFuelMode('PESOS');
                      setFuelAmountInput('500');
                    }}
                    className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      fuelMode === 'PESOS'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    By Pesos (₱)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFuelMode('LITERS');
                      setFuelAmountInput('10');
                    }}
                    className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      fuelMode === 'LITERS'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    By Liters (L)
                  </button>
                </div>
              </div>

              <div className="sm:col-span-5">
                <label htmlFor="fuel-amount-input" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  {fuelMode === 'PESOS' ? 'Amount in Pesos (₱)' : 'Volume in Liters (L)'}
                </label>
                <input
                  id="fuel-amount-input"
                  type="number"
                  min="0"
                  step={fuelMode === 'PESOS' ? '1' : '0.01'}
                  value={fuelAmountInput}
                  onChange={(e) => setFuelAmountInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddFuel();
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-base font-mono font-semibold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={handleAddFuel}
                  disabled={!selectedTank || fuelCalc.liters <= 0}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  Add Fuel
                </button>
              </div>
            </div>

            {/* Presets & Live Conversion */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                {presets.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFuelAmountInput(String(val))}
                    className={`px-3.5 py-2 text-xs font-mono font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      Number(fuelAmountInput) === val
                        ? 'bg-slate-900 dark:bg-teal-600 text-white border-slate-900 dark:border-teal-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {fuelMode === 'PESOS' ? `₱${val.toLocaleString()}` : `${val} L`}
                  </button>
                ))}
              </div>

              {selectedTank && (
                <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                  <span>{formatLiters(fuelCalc.liters, 3)}</span>
                  <span aria-hidden="true" className="mx-1.5 text-slate-400 dark:text-slate-600">·</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPeso(fuelCalc.pesos)}</span>
                </div>
              )}
            </div>
          </section>

          {/* Convenience Store Items */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">2. Convenience Store Add-Ons</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tap any product tile to add one unit to the order</p>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search SKU or item..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-4">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    categoryFilter === cat
                      ? 'bg-slate-900 dark:bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {cat === 'ALL' ? 'All Items' : cat}
                </button>
              ))}
            </div>

            {filteredStore.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">No matching convenience store items.</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredStore.map((item) => {
                  const inCartQty = cartQtyByStoreId.get(item.id) || 0;
                  const remainingStock = Math.max(0, item.stockQty - inCartQty);
                  const outOfStock = remainingStock <= 0;
                  const lowStock = remainingStock > 0 && remainingStock <= item.reorderLevel;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={outOfStock}
                      onClick={() => handleAddStoreItem(item)}
                      className={`text-left p-4 rounded-xl border transition-colors flex flex-col justify-between ${
                        outOfStock
                          ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                          : inCartQty > 0
                          ? 'bg-teal-50/40 dark:bg-teal-950/30 border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/50'
                          : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.category} · <span className="font-mono">{item.sku}</span>
                          </p>
                        </div>
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 shrink-0">
                          {formatPeso(item.unitPrice)}
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between text-xs">
                        <span
                          className={`font-mono ${
                            outOfStock
                              ? 'text-red-600 dark:text-red-400 font-semibold'
                              : lowStock
                              ? 'text-amber-700 dark:text-amber-400 font-medium'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {item.stockQty <= 0
                            ? 'Out of stock'
                            : remainingStock <= 0
                            ? 'Max in order'
                            : `${remainingStock} left`}
                        </span>
                        <span className="font-semibold text-teal-700 dark:text-teal-400">
                          {inCartQty > 0
                            ? remainingStock <= 0
                              ? `In cart: ${inCartQty}`
                              : `In cart: ${inCartQty} (+1)`
                            : '+ Add'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Current Order & Checkout */}
        <aside
          ref={ticketRef}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 lg:sticky lg:top-20"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                3. Order Ticket {cart.length > 0 ? `(${cart.length})` : ''}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{pumpLabel}</p>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setPendingRemove({ type: 'CLEAR' })}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors whitespace-nowrap"
              >
                Clear Order
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="py-12 text-center border-b border-slate-200 dark:border-slate-800">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Order ticket is empty</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Select a fuel grade or tap a convenience store item to start billing.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto border-b border-slate-200 dark:border-slate-800">
              {cart.map((line) => (
                <div key={line.key} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{line.name}</p>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      {line.itemType === 'FUEL'
                        ? `${line.quantity.toFixed(3)} L × ${formatPeso(line.unitPrice)}/L`
                        : `${line.quantity} pc × ${formatPeso(line.unitPrice)}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {line.itemType === 'STORE' && (
                      <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg">
                        <button
                          type="button"
                          onClick={() => adjustStoreQty(line.key, -1)}
                          aria-label={`Decrease quantity of ${line.name}`}
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-mono font-semibold">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => adjustStoreQty(line.key, 1)}
                          aria-label={`Increase quantity of ${line.name}`}
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 w-20 text-right">
                      {formatPeso(line.lineTotal)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setPendingRemove({ type: 'LINE', line })}
                      aria-label={`Remove ${line.name}`}
                      title={`Remove ${line.name}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals Summary */}
          <div className="py-4 space-y-1.5 border-b border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>VATable Sales</span>
              <span className="font-mono">{formatPeso(vatableSales)}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>12% VAT</span>
              <span className="font-mono">{formatPeso(vatAmount)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 text-slate-900 dark:text-slate-100">
              <span className="text-sm font-semibold">Total Due</span>
              <span className="font-mono text-2xl font-bold">{formatPeso(orderTotal)}</span>
            </div>
          </div>

          {/* Payment Method & Cash Tendered */}
          <div className="pt-4 space-y-4">
            <div>
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Payment Method</span>
              <div className="grid grid-cols-3 gap-2">
                {(['CASH', 'CARD', 'GCASH'] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                      paymentMethod === method
                        ? 'bg-slate-900 dark:bg-teal-600 text-white border-slate-900 dark:border-teal-500'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {method === 'GCASH' ? 'GCash' : method.charAt(0) + method.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'CASH' && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="cash-tendered" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Cash Tendered (₱)
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {orderTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => setTenderedInput(orderTotal.toFixed(2))}
                        className="px-2.5 py-1 text-[11px] font-mono font-medium bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-md"
                      >
                        Exact ({formatPeso(orderTotal)})
                      </button>
                    )}
                    {smartCashSuggestions.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTenderedInput(String(amt))}
                        className="px-2.5 py-1 text-[11px] font-mono bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md"
                      >
                        ₱{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  id="cash-tendered"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tenderedInput}
                  onChange={(e) => setTenderedInput(e.target.value)}
                  placeholder={orderTotal > 0 ? orderTotal.toFixed(2) : '0.00'}
                  className="w-full px-3.5 py-2.5 text-base font-mono font-semibold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />

                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-slate-600 dark:text-slate-400">
                    {cashShortBy > 0 ? 'Short By' : 'Change Due'}
                  </span>
                  <span
                    className={`font-mono text-base font-bold ${
                      cashShortBy > 0 ? 'text-red-700 dark:text-red-400' : 'text-teal-700 dark:text-teal-400'
                    }`}
                  >
                    {cashShortBy > 0 ? formatPeso(cashShortBy) : formatPeso(changeDue)}
                  </span>
                </div>
              </div>
            )}

            {checkoutError && (
              <div role="alert" className="px-3 py-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg">
                {checkoutError}
              </div>
            )}

            <button
              type="button"
              disabled={submitting || cart.length === 0}
              onClick={handleCompleteSale}
              className="w-full py-3.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {submitting ? 'Recording Sale...' : 'Complete Sale & Print Receipt'}
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile Sticky Jump-to-Ticket Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-t border-slate-800">
          <div className="text-xs">
            <span className="text-slate-300">{cart.length} item(s)</span>
            <span aria-hidden="true" className="mx-2 text-slate-500">·</span>
            <span className="font-mono font-bold text-sm">{formatPeso(orderTotal)}</span>
          </div>
          <button
            type="button"
            onClick={() => ticketRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg whitespace-nowrap"
          >
            Review &amp; Pay
          </button>
        </div>
      )}

      {pendingRemove && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-remove-title"
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 id="confirm-remove-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {pendingRemove.type === 'CLEAR'
                ? 'Clear Order Ticket?'
                : `Remove ${pendingRemove.line.name}?`}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {pendingRemove.type === 'CLEAR'
                ? `This will remove all ${cart.length} item(s) totaling ${formatPeso(orderTotal)} from the current order ticket.`
                : `Remove ${
                    pendingRemove.line.itemType === 'FUEL'
                      ? `${pendingRemove.line.quantity.toFixed(3)} L`
                      : `${pendingRemove.line.quantity} pc`
                  } (${formatPeso(pendingRemove.line.lineTotal)}) from the current order?`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingRemove(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveAction}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg whitespace-nowrap"
              >
                {pendingRemove.type === 'CLEAR' ? 'Clear Order' : 'Remove Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReceiptModal sale={completedSale} onClose={() => setCompletedSale(null)} />
    </>
  );
}
