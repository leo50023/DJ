import React, { useEffect, useState } from 'react';
import { Building2, Edit3, Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatPeso } from '../lib/format';
import type { Station, UserRole } from '../lib/types';

export function StationsView() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<
    Array<{ role: UserRole; username: string; password: string }>
  >([]);

  // Add Station modal
  const [showAdd, setShowAdd] = useState(false);
  const [code, setCode] = useState('');
  const [brand, setBrand] = useState('PetroDesk');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [tin, setTin] = useState('009-482-110-000');
  const [seedStarterInventory, setSeedStarterInventory] = useState(true);
  const [createDefaultStaff, setCreateDefaultStaff] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit Station modal
  const [editing, setEditing] = useState<Station | null>(null);
  const [editBrand, setEditBrand] = useState('');
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editTin, setEditTin] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState<Station | null>(null);

  const showNotice = (msg: string) => {
    setSuccessMsg(msg);
    window.setTimeout(() => setSuccessMsg((c) => (c === msg ? null : c)), 4000);
  };

  const loadStations = async () => {
    try {
      const res = await api.listStations();
      setStations(res.stations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gas stations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStations();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.createStation({
        code,
        name,
        brand,
        address,
        tin,
        seedStarterInventory,
        createDefaultStaff,
      });
      setShowAdd(false);
      setCode('');
      setBrand('PetroDesk');
      setName('');
      setAddress('');
      setTin('009-482-110-000');
      setCreatedCredentials(res.generatedAccounts || []);
      showNotice(`Gas station "${res.station.brand} · ${res.station.name}" added.`);
      await loadStations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create gas station.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateStation(editing.id, {
        brand: editBrand,
        name: editName,
        address: editAddress,
        tin: editTin,
      });
      showNotice(`Updated ${editBrand} · ${editName}.`);
      setEditing(null);
      await loadStations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update gas station.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (st: Station) => {
    setSaving(true);
    setError(null);
    try {
      await api.updateStation(st.id, { active: !st.active });
      showNotice(`${st.name} is now ${!st.active ? 'Active' : 'Inactive'}.`);
      setDeactivateTarget(null);
      await loadStations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update station status.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />;
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
      {createdCredentials.length > 0 && (
        <div className="px-4 py-3 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Generated Starter Accounts for New Station</p>
            <div className="flex flex-wrap gap-4 font-mono text-slate-700 dark:text-slate-300">
              {createdCredentials.map((acc) => (
                <span key={acc.username}>
                  {acc.role}: <strong>{acc.username}</strong> / {acc.password}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreatedCredentials([])}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Registered Gas Stations</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Connect any fuel brand or branch location — each station maintains isolated tanks, store SKUs, receipts, and Z-readings
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Gas Station</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((st) => (
            <div
              key={st.id}
              className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-5 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-slate-500 dark:text-slate-400">{st.code}</span>
                  <span className={`font-medium ${st.active ? 'text-teal-700 dark:text-teal-400' : 'text-red-700 dark:text-red-400'}`}>
                    {st.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mt-2 flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">{st.brand}</p>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{st.name}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{st.address}</p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-500 mt-1">TIN: {st.tin}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Tanks</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{st.tankCount ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Staff</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{st.staffCount ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Revenue</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatPeso(st.totalRevenue ?? 0)}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(st);
                      setEditBrand(st.brand);
                      setEditName(st.name);
                      setEditAddress(st.address);
                      setEditTin(st.tin);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (st.active) {
                        setDeactivateTarget(st);
                      } else {
                        handleToggleActive(st);
                      }
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {st.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Register Gas Station</h3>
              <button type="button" onClick={() => setShowAdd(false)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Station Code</label>
                <input
                  type="text"
                  required
                  placeholder="STN-04"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Brand / Network</label>
                <input
                  type="text"
                  required
                  placeholder="Shell / Petron / Caltex"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Branch / Station Name</label>
              <input
                type="text"
                required
                placeholder="Commonwealth Ave. Branch"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Station Address</label>
              <input
                type="text"
                required
                placeholder="Commonwealth Ave, Quezon City"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">VAT REG TIN</label>
              <input
                type="text"
                required
                value={tin}
                onChange={(e) => setTin(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={seedStarterInventory}
                  onChange={(e) => setSeedStarterInventory(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-teal-700"
                />
                <span>Initialize default fuel tanks (Unleaded 91, Premium 95, Diesel) &amp; store SKUs</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={createDefaultStaff}
                  onChange={(e) => setCreateDefaultStaff(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-teal-700"
                />
                <span>Create starter Manager &amp; Cashier accounts for this branch</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg"
              >
                {saving ? 'Creating...' : 'Create Station'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={handleSaveEdit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Edit {editing.code}</h3>
              <button type="button" onClick={() => setEditing(null)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Brand / Network</label>
              <input
                type="text"
                required
                value={editBrand}
                onChange={(e) => setEditBrand(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Branch / Station Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
              <input
                type="text"
                required
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">VAT REG TIN</label>
              <input
                type="text"
                required
                value={editTin}
                onChange={(e) => setEditTin(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deactivateTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-station-deactivate"
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 id="confirm-station-deactivate" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Deactivate {deactivateTarget.name}?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Staff assigned to <span className="font-mono font-semibold">{deactivateTarget.code}</span> will not be able to sign in or ring sales while this branch is inactive. Historical receipts remain preserved.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setDeactivateTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleToggleActive(deactivateTarget)}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-lg whitespace-nowrap"
              >
                {saving ? 'Deactivating...' : 'Confirm Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
