import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatDateTime, formatLiters, formatPeso } from '../lib/format';
import type { FuelTank, InventoryAdjustment, StoreItem } from '../lib/types';

export function InventoryView() {
  const [tanks, setTanks] = useState<FuelTank[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [storeSearch, setStoreSearch] = useState('');

  // Fuel adjust modal
  const [editingTank, setEditingTank] = useState<FuelTank | null>(null);
  const [tankAdjustMode, setTankAdjustMode] = useState<'DELTA' | 'SET'>('DELTA');
  const [tankDeltaLiters, setTankDeltaLiters] = useState('0');
  const [tankTargetLiters, setTankTargetLiters] = useState('0');
  const [tankPrice, setTankPrice] = useState('0');
  const [tankReason, setTankReason] = useState('Tanker Delivery');
  const [tankModalError, setTankModalError] = useState<string | null>(null);
  const [savingTank, setSavingTank] = useState(false);

  // Store restock/edit modal
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [itemDeltaQty, setItemDeltaQty] = useState('0');
  const [itemPrice, setItemPrice] = useState('0');
  const [itemActive, setItemActive] = useState(true);
  const [itemReason, setItemReason] = useState('Supplier Restock');
  const [itemModalError, setItemModalError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  // New store item modal
  const [showNewItem, setShowNewItem] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Lubricants');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('10');
  const [newReorder, setNewReorder] = useState('5');

  // New fuel tank modal
  const [showNewTank, setShowNewTank] = useState(false);
  const [newTankCode, setNewTankCode] = useState('');
  const [newTankName, setNewTankName] = useState('');
  const [newTankPrice, setNewTankPrice] = useState('65.00');
  const [newTankCap, setNewTankCap] = useState('20000');
  const [newTankCurrent, setNewTankCurrent] = useState('10000');
  const [newTankThreshold, setNewTankThreshold] = useState('4000');

  const showNotice = (msg: string) => {
    setSuccessMsg(msg);
    window.setTimeout(() => setSuccessMsg((c) => (c === msg ? null : c)), 3000);
  };

  const loadInventory = async () => {
    try {
      const data = await api.getInventory();
      setTanks(data.tanks);
      setStoreItems(data.storeItems);
      setAdjustments(data.adjustments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const filteredStoreItems = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return storeItems;
    return storeItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [storeItems, storeSearch]);

  const tankPreview = useMemo(() => {
    if (!editingTank) return { resultingLiters: 0, deltaLiters: 0, isValid: true, validationError: null as string | null };
    if (tankAdjustMode === 'SET') {
      const target = parseFloat(tankTargetLiters);
      if (!Number.isFinite(target)) {
        return { resultingLiters: editingTank.currentLiters, deltaLiters: 0, isValid: false, validationError: 'Enter a valid target volume.' };
      }
      const delta = Math.round((target - editingTank.currentLiters) * 1000) / 1000;
      if (target < 0 || target > editingTank.capacityLiters) {
        return {
          resultingLiters: target,
          deltaLiters: delta,
          isValid: false,
          validationError: `Target volume must be between 0 and ${editingTank.capacityLiters.toLocaleString()} L.`,
        };
      }
      return { resultingLiters: target, deltaLiters: delta, isValid: true, validationError: null };
    }
    const delta = parseFloat(tankDeltaLiters || '0');
    if (!Number.isFinite(delta)) {
      return { resultingLiters: editingTank.currentLiters, deltaLiters: 0, isValid: false, validationError: 'Enter a valid adjustment amount.' };
    }
    const resulting = Math.round((editingTank.currentLiters + delta) * 1000) / 1000;
    if (resulting < 0 || resulting > editingTank.capacityLiters) {
      const maxAdd = Math.max(0, Math.round((editingTank.capacityLiters - editingTank.currentLiters) * 100) / 100);
      return {
        resultingLiters: resulting,
        deltaLiters: delta,
        isValid: false,
        validationError:
          resulting > editingTank.capacityLiters
            ? `Exceeds ${editingTank.capacityLiters.toLocaleString()} L capacity (max you can add: ${maxAdd.toLocaleString()} L).`
            : 'Resulting volume cannot be less than 0 L.',
      };
    }
    return { resultingLiters: resulting, deltaLiters: delta, isValid: true, validationError: null };
  }, [editingTank, tankAdjustMode, tankDeltaLiters, tankTargetLiters]);

  const handleSaveTank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTank || !tankPreview.isValid) return;
    setSavingTank(true);
    setTankModalError(null);
    setError(null);
    try {
      await api.adjustFuelTank(editingTank.id, {
        ...(tankAdjustMode === 'SET'
          ? { targetLiters: parseFloat(tankTargetLiters) }
          : { deltaLiters: parseFloat(tankDeltaLiters) || 0 }),
        pricePerLiter: parseFloat(tankPrice) || editingTank.pricePerLiter,
        reason: tankReason.trim() || 'Tank Adjustment',
      });
      showNotice(`Updated ${editingTank.name} tank.`);
      setEditingTank(null);
      await loadInventory();
    } catch (err) {
      setTankModalError(err instanceof Error ? err.message : 'Failed to update fuel tank.');
    } finally {
      setSavingTank(false);
    }
  };

  const handleSaveStoreItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSavingItem(true);
    setItemModalError(null);
    setError(null);
    try {
      await api.updateStoreItem(editingItem.id, {
        deltaQty: parseInt(itemDeltaQty, 10) || 0,
        unitPrice: parseFloat(itemPrice) || editingItem.unitPrice,
        active: itemActive,
        reason: itemReason.trim() || 'Stock Adjustment',
      });
      showNotice(`Updated ${editingItem.name}.`);
      setEditingItem(null);
      await loadInventory();
    } catch (err) {
      setItemModalError(err instanceof Error ? err.message : 'Failed to update store item.');
    } finally {
      setSavingItem(false);
    }
  };

  const handleCreateStoreItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingItem(true);
    setError(null);
    try {
      await api.createStoreItem({
        sku: newSku,
        name: newName,
        category: newCategory,
        unitPrice: parseFloat(newPrice) || 0,
        stockQty: parseInt(newStock, 10) || 0,
        reorderLevel: parseInt(newReorder, 10) || 5,
      });
      showNotice(`Created SKU ${newSku.toUpperCase()}.`);
      setShowNewItem(false);
      setNewSku('');
      setNewName('');
      setNewPrice('');
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add store item.');
    } finally {
      setSavingItem(false);
    }
  };

  const handleCreateTank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTank(true);
    setError(null);
    try {
      await api.createFuelTank({
        code: newTankCode,
        name: newTankName,
        pricePerLiter: parseFloat(newTankPrice) || 0,
        capacityLiters: parseFloat(newTankCap) || 20000,
        currentLiters: parseFloat(newTankCurrent) || 0,
        reorderThresholdLiters: parseFloat(newTankThreshold) || 3000,
      });
      showNotice(`Added fuel grade ${newTankName} (${newTankCode.toUpperCase()}).`);
      setShowNewTank(false);
      setNewTankCode('');
      setNewTankName('');
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add fuel tank.');
    } finally {
      setSavingTank(false);
    }
  };

  if (loading) {
    return <div className="h-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="px-4 py-3 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="px-4 py-3 text-xs font-medium text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 rounded-xl">
          {successMsg}
        </div>
      )}

      {/* Fuel Tanks Section */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Software-Tracked Fuel Tanks</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automatically deducted on every POS sale; log tanker deliveries, mark Out of Gas, or update pump prices
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewTank(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Fuel Grade</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tanks.map((tank) => {
            const pct = Math.min(100, Math.round((tank.currentLiters / tank.capacityLiters) * 100));
            const isOut = tank.currentLiters <= 0;
            const isLow = !isOut && tank.currentLiters <= tank.reorderThresholdLiters;
            return (
              <div key={tank.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-500 dark:text-slate-400">{tank.code}</span>
                    <span
                      className={`font-medium ${
                        isOut
                          ? 'text-red-700 dark:text-red-400'
                          : isLow
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-teal-700 dark:text-teal-400'
                      }`}
                    >
                      {isOut ? 'Out of Gas' : isLow ? 'Low Tank' : 'Nominal'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1.5">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{tank.name}</h3>
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                      {formatPeso(tank.pricePerLiter)}/L
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs font-mono text-slate-600 dark:text-slate-400 mb-1.5">
                      <span>{formatLiters(tank.currentLiters)}</span>
                      <span>{pct}% of {tank.capacityLiters.toLocaleString()} L</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${
                          isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-teal-600 dark:bg-teal-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTank(tank);
                      setTankAdjustMode('DELTA');
                      setTankDeltaLiters('0');
                      setTankTargetLiters(tank.currentLiters.toFixed(2));
                      setTankPrice(String(tank.pricePerLiter));
                      setTankReason('Tanker Delivery');
                      setTankModalError(null);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Adjust Volume / Price
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Convenience Store Inventory */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Convenience Store Stock</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage retail SKUs, restock deliveries, and shelf prices</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                placeholder="Search SKU or name..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowNewItem(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Store SKU</span>
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-2 text-left font-medium">SKU</th>
                <th className="py-2.5 px-2 text-left font-medium">Product</th>
                <th className="py-2.5 px-2 text-left font-medium">Category</th>
                <th className="py-2.5 px-2 text-right font-medium">Unit Price</th>
                <th className="py-2.5 px-2 text-right font-medium">Stock</th>
                <th className="py-2.5 px-2 text-left font-medium">Status</th>
                <th className="py-2.5 px-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStoreItems.map((item) => {
                const isLow = item.stockQty <= item.reorderLevel;
                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-2 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{item.sku}</td>
                    <td className="py-3 px-2 font-medium text-slate-900 dark:text-slate-100">{item.name}</td>
                    <td className="py-3 px-2 text-slate-600 dark:text-slate-400">{item.category}</td>
                    <td className="py-3 px-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {formatPeso(item.unitPrice)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-slate-800 dark:text-slate-200">{item.stockQty}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`font-medium ${
                          !item.active
                            ? 'text-slate-400 dark:text-slate-500'
                            : item.stockQty === 0
                            ? 'text-red-700 dark:text-red-400'
                            : isLow
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-teal-700 dark:text-teal-400'
                        }`}
                      >
                        {!item.active
                          ? 'Hidden on POS'
                          : item.stockQty === 0
                          ? 'Out of Stock'
                          : isLow
                          ? 'Reorder Soon'
                          : 'In Stock'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(item);
                          setItemDeltaQty('0');
                          setItemPrice(String(item.unitPrice));
                          setItemActive(Boolean(item.active));
                          setItemReason('Supplier Restock');
                          setItemModalError(null);
                        }}
                        className="px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors whitespace-nowrap"
                      >
                        Restock / Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Audit Log */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-200 dark:border-slate-800">
          Recent Inventory Movements
        </h3>
        {adjustments.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">No inventory movements logged yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-2 text-left font-medium">Timestamp</th>
                  <th className="py-2.5 px-2 text-left font-medium">Item</th>
                  <th className="py-2.5 px-2 text-right font-medium">Change</th>
                  <th className="py-2.5 px-2 text-left font-medium">Reason</th>
                  <th className="py-2.5 px-2 text-left font-medium">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {adjustments.map((adj) => (
                  <tr key={adj.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-2 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(adj.createdAt)}
                    </td>
                    <td className="py-2.5 px-2 font-medium text-slate-900 dark:text-slate-100">{adj.itemName}</td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono font-semibold whitespace-nowrap ${
                        adj.deltaQty >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {adj.deltaQty >= 0 ? `+${adj.deltaQty}` : adj.deltaQty}{' '}
                      {adj.itemType === 'FUEL' ? 'L' : 'pc'}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400">{adj.reason}</td>
                    <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300">{adj.performedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Fuel Tank Modal */}
      {editingTank && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={handleSaveTank} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Update {editingTank.name}</h3>
              <button type="button" onClick={() => setEditingTank(null)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Current Volume</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {formatLiters(editingTank.currentLiters, 2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Available Space</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {formatLiters(Math.max(0, editingTank.capacityLiters - editingTank.currentLiters), 2)}
                </span>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Adjustment Method</span>
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setTankAdjustMode('DELTA');
                    setTankModalError(null);
                  }}
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    tankAdjustMode === 'DELTA'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Add / Subtract (± L)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTankAdjustMode('SET');
                    setTankTargetLiters(editingTank.currentLiters.toFixed(2));
                    setTankModalError(null);
                  }}
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    tankAdjustMode === 'SET'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Set Exact Reading (L)
                </button>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {tankAdjustMode === 'DELTA'
                    ? 'Add / Adjust Liters (negative for shrinkage)'
                    : 'New Tank Reading (Liters)'}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTankAdjustMode('SET');
                      setTankTargetLiters('0');
                      setTankReason('Out of Gas');
                      setTankModalError(null);
                    }}
                    className="text-[11px] font-medium text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 whitespace-nowrap"
                  >
                    Mark Out of Gas (0 L)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const maxAdd = Math.max(
                        0,
                        Math.round((editingTank.capacityLiters - editingTank.currentLiters) * 1000) / 1000
                      );
                      if (tankAdjustMode === 'DELTA') {
                        setTankDeltaLiters(String(maxAdd));
                      } else {
                        setTankTargetLiters(String(editingTank.capacityLiters));
                      }
                      setTankReason('Tanker Delivery');
                      setTankModalError(null);
                    }}
                    className="text-[11px] font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 whitespace-nowrap"
                  >
                    Fill to Max ({editingTank.capacityLiters.toLocaleString()} L)
                  </button>
                </div>
              </div>
              {tankAdjustMode === 'DELTA' ? (
                <input
                  type="number"
                  step="0.01"
                  value={tankDeltaLiters}
                  onChange={(e) => {
                    setTankDeltaLiters(e.target.value);
                    setTankModalError(null);
                  }}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              ) : (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={editingTank.capacityLiters}
                  value={tankTargetLiters}
                  onChange={(e) => {
                    setTankTargetLiters(e.target.value);
                    setTankModalError(null);
                  }}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              )}

              <div className="mt-1.5 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 dark:text-slate-400">New Tank Level:</span>
                <span className={tankPreview.isValid ? 'font-semibold text-teal-700 dark:text-teal-400' : 'font-semibold text-red-700 dark:text-red-400'}>
                  {formatLiters(tankPreview.resultingLiters, 2)} / {editingTank.capacityLiters.toLocaleString()} L
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Price per Liter (₱)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={tankPrice}
                onChange={(e) => setTankPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Reason / Manifest #</label>
              <input
                type="text"
                value={tankReason}
                onChange={(e) => setTankReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            {(tankPreview.validationError || tankModalError) && (
              <div role="alert" className="px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg">
                {tankModalError || tankPreview.validationError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTank(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingTank || !tankPreview.isValid}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg"
              >
                {savingTank ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Store Item Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={handleSaveStoreItem} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Restock / Edit {editingItem.name}</h3>
              <button type="button" onClick={() => setEditingItem(null)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Quantity Change (current: {editingItem.stockQty})
              </label>
              <input
                type="number"
                step="1"
                value={itemDeltaQty}
                onChange={(e) => setItemDeltaQty(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Unit Price (₱)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Reason</label>
              <input
                type="text"
                value={itemReason}
                onChange={(e) => setItemReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={itemActive}
                onChange={(e) => setItemActive(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-teal-700 focus:ring-teal-600"
              />
              <span>Visible for sale on POS Terminal</span>
            </label>
            {itemModalError && (
              <div role="alert" className="px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg">
                {itemModalError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingItem}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg"
              >
                {savingItem ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Store Item Modal */}
      {showNewItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={handleCreateStoreItem} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Add Convenience Store SKU</h3>
              <button type="button" onClick={() => setShowNewItem(false)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">SKU Code</label>
                <input
                  type="text"
                  required
                  placeholder="BEV-SODA"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="Lubricants">Lubricants</option>
                  <option value="Auto Care">Auto Care</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Snacks">Snacks</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Product Name</label>
              <input
                type="text"
                required
                placeholder="Brake Fluid DOT4 (250ml)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Price (₱)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="1"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Initial Stock</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Reorder At</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newReorder}
                  onChange={(e) => setNewReorder(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewItem(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingItem}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                {savingItem ? 'Adding...' : 'Create Item'}
              </button>
            </div>
          </form>
        </div>
      )}
      {showNewTank && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={handleCreateTank} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Add Fuel Grade / Tank</h3>
              <button type="button" onClick={() => setShowNewTank(false)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tank Code</label>
                <input
                  type="text"
                  required
                  placeholder="PRM-97"
                  value={newTankCode}
                  onChange={(e) => setNewTankCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Price per Liter (₱)</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="1"
                  value={newTankPrice}
                  onChange={(e) => setNewTankPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Fuel Grade Name</label>
              <input
                type="text"
                required
                placeholder="V-Power Racing 97"
                value={newTankName}
                onChange={(e) => setNewTankName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Capacity (L)</label>
                <input
                  type="number"
                  required
                  min="100"
                  value={newTankCap}
                  onChange={(e) => setNewTankCap(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Initial (L)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newTankCurrent}
                  onChange={(e) => setNewTankCurrent(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Low Alert (L)</label>
                <input
                  type="number"
                  required
                  min="100"
                  value={newTankThreshold}
                  onChange={(e) => setNewTankThreshold(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewTank(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingTank}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                {savingTank ? 'Adding...' : 'Add Tank'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
