import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, CheckCircle2, Eye, EyeOff, Fuel, Moon, Sun, UserPlus } from 'lucide-react';
import { api, setApiToken } from '../lib/api';
import type { ThemeMode } from '../lib/theme';
import type { AuthUser, PublicStation } from '../lib/types';

interface RegisterViewProps {
  onSuccess: (user: AuthUser, token: string) => void;
  onBackToSignIn: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

type RegisterTab = 'STATION' | 'STAFF';

export function RegisterView({ onSuccess, onBackToSignIn, theme, onToggleTheme }: RegisterViewProps) {
  const [tab, setTab] = useState<RegisterTab>('STATION');
  const [stations, setStations] = useState<PublicStation[]>([]);

  // Station Owner / Manager Registration State
  const [brand, setBrand] = useState('PetroDesk');
  const [stationName, setStationName] = useState('');
  const [stationCode, setStationCode] = useState('');
  const [address, setAddress] = useState('');
  const [tin, setTin] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerUsername, setManagerUsername] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [showManagerPw, setShowManagerPw] = useState(false);
  const [seedStarterInventory, setSeedStarterInventory] = useState(true);
  const [createStarterCashier, setCreateStarterCashier] = useState(true);

  // Cashier Request State
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [staffName, setStaffName] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPw, setShowStaffPw] = useState(false);
  const [staffSubmittedMsg, setStaffSubmittedMsg] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listPublicStations()
      .then((res) => {
        setStations(res.stations);
        if (res.stations.length > 0) {
          setSelectedStationId(String(res.stations[0].id));
        }
      })
      .catch(() => {
        // Silent fallback
      });
  }, []);

  const handleStationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.registerStation({
        stationCode: stationCode.trim() || undefined,
        brand: brand.trim() || 'PetroDesk',
        stationName: stationName.trim(),
        address: address.trim(),
        tin: tin.trim() || undefined,
        fullName: managerName.trim(),
        username: managerUsername.trim(),
        password: managerPassword,
        seedStarterInventory,
        createStarterCashier,
      });
      setApiToken(res.token);
      onSuccess(res.user, res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register gas station.');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStationId) {
      setError('Please select a gas station branch.');
      return;
    }
    setError(null);
    setStaffSubmittedMsg(null);
    setLoading(true);
    try {
      const res = await api.registerStaff({
        stationId: Number(selectedStationId),
        fullName: staffName.trim(),
        username: staffUsername.trim(),
        password: staffPassword,
      });
      setStaffSubmittedMsg(res.message);
      setStaffName('');
      setStaffUsername('');
      setStaffPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit cashier registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {/* Left: Registration Form */}
        <div className="md:col-span-7 p-8 sm:p-10">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-900 dark:bg-teal-700 text-white flex items-center justify-center shrink-0">
                <Fuel className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">PetroDesk</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Station &amp; Operator Onboarding</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBackToSignIn}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
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
          </div>

          {/* Segmented Tab Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setTab('STATION');
                setError(null);
                setStaffSubmittedMsg(null);
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                tab === 'STATION'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span>Register Gas Station</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('STAFF');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                tab === 'STAFF'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span>Join as Cashier</span>
            </button>
          </div>

          {tab === 'STATION' ? (
            <form onSubmit={handleStationSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-brand" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Station Brand
                  </label>
                  <input
                    id="reg-brand"
                    type="text"
                    required
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Petron, Shell, Caltex, Unioil..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label htmlFor="reg-code" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Station Code (optional)
                  </label>
                  <input
                    id="reg-code"
                    type="text"
                    value={stationCode}
                    onChange={(e) => setStationCode(e.target.value.toUpperCase())}
                    placeholder="Auto (e.g. STN-04)"
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-station-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Branch / Station Name
                </label>
                <input
                  id="reg-station-name"
                  type="text"
                  required
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  placeholder="e.g. Highway East Branch"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="reg-address" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Station Address
                  </label>
                  <input
                    id="reg-address"
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, Barangay, City"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label htmlFor="reg-tin" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    VAT Reg TIN
                  </label>
                  <input
                    id="reg-tin"
                    type="text"
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    placeholder="009-482-110-000"
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2.5">
                  Station Manager Account
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-mgr-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Manager Full Name
                    </label>
                    <input
                      id="reg-mgr-name"
                      type="text"
                      required
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      placeholder="Juan Dela Cruz"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-mgr-user" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Username
                    </label>
                    <input
                      id="reg-mgr-user"
                      type="text"
                      required
                      value={managerUsername}
                      onChange={(e) => setManagerUsername(e.target.value)}
                      placeholder="owner_juan"
                      className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label htmlFor="reg-mgr-pw" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Password / PIN (min 4 characters)
                  </label>
                  <div className="relative">
                    <input
                      id="reg-mgr-pw"
                      type={showManagerPw ? 'text' : 'password'}
                      required
                      minLength={4}
                      value={managerPassword}
                      onChange={(e) => setManagerPassword(e.target.value)}
                      placeholder="Create a secure password"
                      className="w-full pl-3 pr-9 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowManagerPw((v) => !v)}
                      aria-label={showManagerPw ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {showManagerPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seedStarterInventory}
                    onChange={(e) => setSeedStarterInventory(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span>Load starter fuel grades (Unleaded 91, Premium 95, Diesel) &amp; convenience store SKUs</span>
                </label>
                <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createStarterCashier}
                    onChange={(e) => setCreateStarterCashier(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span>Auto-create a ready Cashier login for this branch (default PIN: cashier123)</span>
                </label>
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
                <Building2 className="w-4 h-4" />
                <span>{loading ? 'Creating Gas Station...' : 'Register Station & Sign In'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleStaffSubmit} className="space-y-4">
              <div>
                <label htmlFor="staff-station-select" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Gas Station Branch
                </label>
                <select
                  id="staff-station-select"
                  required
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {stations.map((st) => (
                    <option key={st.id} value={String(st.id)}>
                      {st.code} · {st.brand} — {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="staff-full-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  id="staff-full-name"
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="Ana Mendoza"
                  className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="staff-username" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Username
                  </label>
                  <input
                    id="staff-username"
                    type="text"
                    required
                    value={staffUsername}
                    onChange={(e) => setStaffUsername(e.target.value)}
                    placeholder="ana_cashier"
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label htmlFor="staff-password" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Password / PIN (min 4 chars)
                  </label>
                  <div className="relative">
                    <input
                      id="staff-password"
                      type={showStaffPw ? 'text' : 'password'}
                      required
                      minLength={4}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="Min 4 characters"
                      className="w-full pl-3.5 pr-9 py-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPw((v) => !v)}
                      aria-label={showStaffPw ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {showStaffPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div role="alert" className="px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg">
                  {error}
                </div>
              )}

              {staffSubmittedMsg && (
                <div className="px-3.5 py-3 text-xs text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 rounded-lg space-y-2">
                  <div className="flex items-start gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{staffSubmittedMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onBackToSignIn}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 underline hover:no-underline"
                  >
                    Return to Sign In
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || stations.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Submitting Request...' : 'Submit Cashier Registration'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Right: Onboarding Scope & Security Guide */}
        <div className="md:col-span-5 bg-slate-50 dark:bg-slate-950/50 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 p-8 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {tab === 'STATION' ? 'How Station Onboarding Works' : 'Cashier Approval Policy'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {tab === 'STATION'
                  ? 'Each gas station registered here runs in its own isolated branch workspace with separate tanks, store SKUs, receipts, and Z-Readings.'
                  : 'For POS drawer and fuel tank security, self-registered cashiers remain pending until approved by an Administrator.'}
              </p>
            </div>

            {tab === 'STATION' ? (
              <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <li className="pb-3 border-b border-slate-200 dark:border-slate-800">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Instant Manager Workspace</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Sign in automatically as your branch Manager to update fuel prices, deliveries, Out-of-Gas tanks, and POS sales.
                  </p>
                </li>
                <li className="pb-3 border-b border-slate-200 dark:border-slate-800">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Custom Station Receipts</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    All Official Receipts and Z-Reading reports display your own brand, branch name, address, and VAT TIN.
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Branch Data Isolation</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Other stations cannot access your inventory, cash counts, or daily revenue reports.
                  </p>
                </li>
              </ul>
            ) : (
              <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <li className="pb-3 border-b border-slate-200 dark:border-slate-800">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">1. Choose Your Station</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Pick the exact branch where you work so your sales deduct from the right tanks.
                  </p>
                </li>
                <li className="pb-3 border-b border-slate-200 dark:border-slate-800">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">2. Pending Verification</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    New accounts start inactive until an Administrator clicks Activate in Staff &amp; Roles.
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">3. Ready to Ring Sales</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Once approved, sign in to access the POS terminal and shift sales log.
                  </p>
                </li>
              </ul>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Already have an account?</span>
            <button
              type="button"
              onClick={onBackToSignIn}
              className="font-semibold text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
            >
              Sign in instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
