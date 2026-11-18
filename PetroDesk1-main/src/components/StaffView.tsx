import React, { useEffect, useState } from 'react';
import { KeyRound, Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatDateTime, roleLabel } from '../lib/format';
import type { AuthUser, StaffUser, Station, UserRole } from '../lib/types';

interface StaffViewProps {
  currentUser: AuthUser;
}

export function StaffView({ currentUser }: StaffViewProps) {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('CASHIER');
  const [stationId, setStationId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<StaffUser | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'INACTIVE'>('ALL');

  const showNotice = (msg: string) => {
    setSuccessMsg(msg);
    window.setTimeout(() => setSuccessMsg((c) => (c === msg ? null : c)), 3000);
  };

  const loadUsers = async () => {
    try {
      const [usersRes, stationsRes] = await Promise.all([api.listUsers(), api.listStations()]);
      setUsers(usersRes.users);
      setStations(stationsRes.stations);
      if (stationsRes.stations.length > 0 && !stationId) {
        setStationId(String(stationsRes.stations[0].id));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createUser({
        username,
        fullName,
        password,
        role,
        stationId: role === 'ADMIN' ? null : Number(stationId) || stations[0]?.id || 1,
      });
      setShowAdd(false);
      setUsername('');
      setFullName('');
      setPassword('');
      setRole('CASHIER');
      showNotice(`Account "${username}" created.`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create staff account.');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId: number, nextRole: UserRole, currentStationId: number | null) => {
    setError(null);
    try {
      await api.updateUser(userId, {
        role: nextRole,
        ...(nextRole !== 'ADMIN' && !currentStationId ? { stationId: stations[0]?.id || 1 } : {}),
      });
      showNotice('Role updated.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role.');
    }
  };

  const handleStationChange = async (userId: number, nextStationId: number) => {
    setError(null);
    try {
      await api.updateUser(userId, { stationId: nextStationId });
      showNotice('Assigned station updated.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update assigned station.');
    }
  };

  const handleToggleActive = async (user: StaffUser) => {
    setError(null);
    setTogglingStatus(true);
    try {
      await api.updateUser(user.id, { active: !user.active });
      showNotice(`${user.fullName} is now ${!user.active ? 'active' : 'disabled'}.`);
      setDeactivateTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account status.');
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || newPassword.length < 4) return;
    setResetting(true);
    setError(null);
    try {
      await api.updateUser(resetTarget.id, { password: newPassword });
      showNotice(`Password updated for ${resetTarget.fullName}.`);
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return <div className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />;
  }

  const inactiveCount = users.filter((u) => !u.active).length;
  const visibleUsers = statusFilter === 'INACTIVE' ? users.filter((u) => !u.active) : users;

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

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Staff &amp; Role Access Control</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Assign Cashier, Station Manager, or Administrator privileges, approve pending requests, and reset passwords
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                All ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('INACTIVE')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === 'INACTIVE'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Pending / Inactive ({inactiveCount})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Staff Account</span>
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-2 text-left font-medium">Full Name</th>
                <th className="py-2.5 px-2 text-left font-medium">Username</th>
                <th className="py-2.5 px-2 text-left font-medium">Assigned Role</th>
                <th className="py-2.5 px-2 text-left font-medium">Gas Station</th>
                <th className="py-2.5 px-2 text-left font-medium">Status</th>
                <th className="py-2.5 px-2 text-left font-medium">Created</th>
                <th className="py-2.5 px-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No pending or inactive staff accounts found.
                  </td>
                </tr>
              ) : (
                visibleUsers.map((u) => {
                  const isSelf = u.id === currentUser.uid;
                  return (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-2 font-medium text-slate-900 dark:text-slate-100">
                      {u.fullName}
                      {isSelf && <span className="ml-2 text-slate-400 dark:text-slate-500 font-normal">(You)</span>}
                    </td>
                    <td className="py-3 px-2 font-mono text-slate-600 dark:text-slate-400">{u.username}</td>
                    <td className="py-3 px-2">
                      <select
                        value={u.role}
                        disabled={isSelf}
                        aria-label={`Role for ${u.fullName}`}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole, u.stationId)}
                        className="px-2.5 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500"
                      >
                        <option value="CASHIER">{roleLabel('CASHIER')}</option>
                        <option value="MANAGER">{roleLabel('MANAGER')}</option>
                        <option value="ADMIN">{roleLabel('ADMIN')}</option>
                      </select>
                    </td>
                    <td className="py-3 px-2">
                      {u.role === 'ADMIN' ? (
                        <span className="text-slate-500 dark:text-slate-400">All Stations (Network)</span>
                      ) : (
                        <select
                          value={u.stationId ?? ''}
                          aria-label={`Station for ${u.fullName}`}
                          onChange={(e) => handleStationChange(u.id, Number(e.target.value))}
                          className="px-2.5 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200"
                        >
                          {stations.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.code} · {st.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`font-medium ${u.active ? 'text-teal-700 dark:text-teal-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {u.active ? 'Active' : 'Pending / Disabled'}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(u.createdAt)}
                    </td>
                    <td className="py-3 px-2 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResetTarget(u);
                          setNewPassword('');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors whitespace-nowrap"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Reset PIN</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => {
                          if (u.active) {
                            setDeactivateTarget(u);
                          } else {
                            handleToggleActive(u);
                          }
                        }}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap disabled:opacity-40 ${
                          u.active
                            ? 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                            : 'text-white bg-teal-700 hover:bg-teal-800'
                        }`}
                      >
                        {u.active ? 'Deactivate' : 'Approve & Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Create Staff Account</h3>
              <button type="button" onClick={() => setShowAdd(false)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="Miguel Bautista"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  placeholder="cashier2"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="CASHIER">Cashier</option>
                  <option value="MANAGER">Station Manager</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              </div>
            </div>
            {role !== 'ADMIN' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Assigned Gas Station</label>
                <select
                  required
                  value={stationId}
                  onChange={(e) => setStationId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {stations.map((st) => (
                    <option key={st.id} value={String(st.id)}>
                      {st.code} · {st.brand} — {st.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password / PIN (min 4 chars)</label>
              <input
                type="password"
                required
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
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
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                {saving ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={handleResetPassword} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Reset Password for {resetTarget.fullName}</h3>
              <button type="button" onClick={() => setResetTarget(null)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">New Password / PIN (min 4 chars)</label>
              <input
                type="password"
                required
                minLength={4}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetting}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                {resetting ? 'Updating...' : 'Save Password'}
              </button>
            </div>
          </form>
        </div>
      )}
      {deactivateTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-deactivate-title"
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 id="confirm-deactivate-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Deactivate {deactivateTarget.fullName}?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Account <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{deactivateTarget.username}</span> will
              immediately lose access to PetroDesk until reactivated by an administrator.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={togglingStatus}
                onClick={() => setDeactivateTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={togglingStatus}
                onClick={() => handleToggleActive(deactivateTarget)}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-lg whitespace-nowrap"
              >
                {togglingStatus ? 'Deactivating...' : 'Confirm Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
