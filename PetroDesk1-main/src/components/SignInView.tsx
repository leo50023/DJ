import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Fuel, Lock, Moon, Sun } from 'lucide-react';
import { api, setApiToken } from '../lib/api';
import type { ThemeMode } from '../lib/theme';
import type { AuthUser, PublicStation } from '../lib/types';

interface SignInViewProps {
  onSuccess: (user: AuthUser, token: string) => void;
  onOpenRegister: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export function SignInView({ onSuccess, onOpenRegister, theme, onToggleTheme }: SignInViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stations, setStations] = useState<PublicStation[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);

  useEffect(() => {
    api
      .listPublicStations()
      .then((res) => {
        setStations(res.stations);
        if (res.stations.length > 0) {
          setSelectedStationId(res.stations[0].id);
        }
      })
      .catch(() => {
        // Fallback silently; manual login still works
      });
  }, []);

  const selectedStation = stations.find((s) => s.id === selectedStationId) || stations[0] || null;

  const performLogin = async (u: string, p: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(u, p);
      setApiToken(res.token);
      onSuccess(res.user, res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(username, password);
  };

  const demoAccounts = [
    {
      label: 'Cashier',
      username: selectedStation?.demoCashierUsername || 'cashier',
      pass: 'cashier123',
      scope: selectedStation
        ? `POS & sales log at ${selectedStation.brand} · ${selectedStation.name}`
        : 'Ring fuel & store sales, issue printable receipts, view shift log',
      disabled: selectedStation ? !selectedStation.demoCashierUsername : false,
    },
    {
      label: 'Station Manager',
      username: selectedStation?.demoManagerUsername || 'manager',
      pass: 'manager123',
      scope: selectedStation
        ? `Inventory, out-of-gas & Z-reading at ${selectedStation.brand} · ${selectedStation.name}`
        : 'Fuel tank stock & out-of-gas updates, store restock, voids, Z-reading & POS',
      disabled: selectedStation ? !selectedStation.demoManagerUsername : false,
    },
    {
      label: 'Administrator',
      username: 'admin',
      pass: 'admin123',
      scope: 'Network revenue analytics across all gas stations, branch setup & staff roles',
      disabled: false,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {/* Left: Station Brand & Credentials Form */}
        <div className="md:col-span-7 p-8 sm:p-10">
          <div className="flex items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-900 dark:bg-teal-700 text-white flex items-center justify-center shrink-0">
                <Fuel className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">PetroDesk</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Multi-Station POS &amp; Sales Management</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
              <span>{theme === 'dark' ? 'Day' : 'Night'}</span>
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Operator Sign In</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Sign in with your assigned branch credentials to open your station terminal or analytics console.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter cashier, manager, or admin"
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password / PIN
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              <Lock className="w-4 h-4" />
              <span>{loading ? 'Signing in...' : 'Sign In to Terminal'}</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Setting up a new gas station or cashier?</span>
            <button
              type="button"
              onClick={onOpenRegister}
              className="font-semibold text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
            >
              Register Station / Cashier
            </button>
          </div>
        </div>

        {/* Right: Branch Picker + One-Click Role Access */}
        <div className="md:col-span-5 bg-slate-50 dark:bg-slate-950/50 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 p-8 flex flex-col justify-center">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick Role Access</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Choose any registered gas station branch to sign in immediately as its Cashier or Manager.
            </p>
          </div>

          {stations.length > 0 && (
            <div className="mb-3">
              <label htmlFor="quick-station-select" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Station Branch (for Cashier &amp; Manager)
              </label>
              <select
                id="quick-station-select"
                value={selectedStation?.id ?? ''}
                onChange={(e) => setSelectedStationId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {stations.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.code} · {st.brand} — {st.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2.5">
            {demoAccounts.map((acct) => (
              <button
                key={acct.label}
                type="button"
                disabled={loading || acct.disabled}
                onClick={() => {
                  setUsername(acct.username);
                  setPassword(acct.pass);
                  performLogin(acct.username, acct.pass);
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-left bg-white dark:bg-slate-900 hover:bg-slate-100/80 dark:hover:bg-slate-800 disabled:opacity-50 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors group"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <span>{acct.label}</span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="font-mono font-normal text-slate-500 dark:text-slate-400">{acct.username}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{acct.scope}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-700 dark:group-hover:text-teal-400 shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
