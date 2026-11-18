import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Building2, Calculator, ClipboardList, Fuel, LogOut, Menu, Moon, Package, Sun, Users, X } from 'lucide-react';
import { api, setApiToken } from './lib/api';
import { roleLabel } from './lib/format';
import { applyTheme, getInitialTheme, type ThemeMode } from './lib/theme';
import type { AuthUser } from './lib/types';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { PosTerminal } from './components/PosTerminal';
import { RegisterView } from './components/RegisterView';
import { SalesAndZReadingView } from './components/SalesAndZReadingView';
import { SignInView } from './components/SignInView';
import { StaffView } from './components/StaffView';
import { StationsView } from './components/StationsView';

export type ActiveSection = 'POS' | 'SALES' | 'DASHBOARD' | 'INVENTORY' | 'STATIONS' | 'STAFF';

const SESSION_KEY = 'petrodesk_session_token';

function defaultSectionForRole(role: AuthUser['role']): ActiveSection {
  if (role === 'ADMIN') return 'DASHBOARD';
  if (role === 'MANAGER') return 'INVENTORY';
  return 'POS';
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>('POS');
  const [authScreen, setAuthScreen] = useState<'signin' | 'register'>('signin');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  useEffect(() => {
    const saved = window.sessionStorage.getItem(SESSION_KEY);
    if (!saved) {
      setRestoring(false);
      return;
    }
    setApiToken(saved);
    api
      .me()
      .then((res) => {
        setUser(res.user);
        setActiveSection(defaultSectionForRole(res.user.role));
      })
      .catch(() => {
        window.sessionStorage.removeItem(SESSION_KEY);
        setApiToken(null);
      })
      .finally(() => {
        setRestoring(false);
      });
  }, []);

  const navItems = useMemo(() => {
    if (!user) return [];
    if (user.role === 'ADMIN') {
      return [
        { id: 'DASHBOARD' as ActiveSection, label: 'Revenue Analytics', icon: BarChart3 },
        { id: 'STATIONS' as ActiveSection, label: 'Gas Stations', icon: Building2 },
        { id: 'STAFF' as ActiveSection, label: 'Staff & Roles', icon: Users },
      ];
    }
    if (user.role === 'MANAGER') {
      return [
        { id: 'INVENTORY' as ActiveSection, label: 'Fuel & Store Stock', icon: Package },
        { id: 'POS' as ActiveSection, label: 'POS Terminal', icon: Calculator },
        { id: 'SALES' as ActiveSection, label: 'Sales & Z-Reading', icon: ClipboardList },
        { id: 'DASHBOARD' as ActiveSection, label: 'Revenue Dashboard', icon: BarChart3 },
      ];
    }
    return [
      { id: 'POS' as ActiveSection, label: 'POS Terminal', icon: Calculator },
      { id: 'SALES' as ActiveSection, label: 'Sales Log', icon: ClipboardList },
    ];
  }, [user]);

  const handleSignIn = (authUser: AuthUser, token: string) => {
    setApiToken(token);
    window.sessionStorage.setItem(SESSION_KEY, token);
    setUser(authUser);
    setActiveSection(defaultSectionForRole(authUser.role));
  };

  const handleSignOut = () => {
    window.sessionStorage.removeItem(SESSION_KEY);
    setApiToken(null);
    setUser(null);
    setAuthScreen('signin');
    setMobileMenuOpen(false);
  };

  if (restoring) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading workstation...</div>
      </div>
    );
  }

  if (!user) {
    if (authScreen === 'register') {
      return (
        <RegisterView
          onSuccess={handleSignIn}
          onBackToSignIn={() => setAuthScreen('signin')}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      );
    }
    return (
      <SignInView
        onSuccess={handleSignIn}
        onOpenRegister={() => setAuthScreen('register')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  const currentNav = navItems.find((n) => n.id === activeSection) || navItems[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 bg-slate-900 dark:bg-slate-950 text-slate-100 border-r border-slate-800 transition-all duration-200 ${
          sidebarCollapsed ? 'md:w-16' : 'md:w-60'
        }`}
      >
        <div
          className={`h-14 flex items-center border-b border-slate-800 ${
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <Fuel className="w-5 h-5 text-teal-400 shrink-0" />
              <span className="text-base font-bold tracking-tight whitespace-nowrap">PetroDesk</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <nav className={`flex-1 py-4 space-y-1 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                aria-label={item.label}
                className={`w-full flex items-center py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3'
                } ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className={`border-t border-slate-800 space-y-2.5 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
          {!sidebarCollapsed && (
            <div className="pb-1">
              <p className="text-xs font-semibold text-white truncate">{user.fullName}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{roleLabel(user.role)}</p>
              <p className="text-[11px] text-teal-400 mt-0.5 truncate">
                {user.role === 'ADMIN'
                  ? 'All Gas Stations'
                  : user.stationName
                  ? `${user.stationBrand || 'PetroDesk'} · ${user.stationName}`
                  : 'Assigned Branch'}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'}
            aria-label={theme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'}
            className={`w-full flex items-center justify-center py-2 text-xs font-medium text-slate-200 bg-slate-800/70 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap ${
              sidebarCollapsed ? 'px-2' : 'gap-2 px-3'
            }`}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" /> : <Moon className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
            {!sidebarCollapsed && <span>{theme === 'dark' ? 'Day Mode' : 'Night Mode'}</span>}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            title={sidebarCollapsed ? 'Switch User / Sign Out' : undefined}
            aria-label="Switch User / Sign Out"
            className={`w-full flex items-center justify-center py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap ${
              sidebarCollapsed ? 'px-2' : 'gap-2 px-3'
            }`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Switch User / Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div className="fixed inset-0 bg-slate-950/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-64 bg-slate-900 text-slate-100 flex flex-col z-50">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Fuel className="w-5 h-5 text-teal-400" />
                <span className="text-base font-bold tracking-tight">PetroDesk</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      active ? 'bg-teal-700 text-white' : 'text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800 space-y-2.5">
              <div className="pb-1">
                <p className="text-xs font-semibold text-white truncate">{user.fullName}</p>
                <p className="text-[11px] text-slate-400">{roleLabel(user.role)}</p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800/70 hover:bg-slate-800 rounded-lg"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{theme === 'dark' ? 'Day Mode' : 'Night Mode'}</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          sidebarCollapsed ? 'md:pl-16' : 'md:pl-60'
        }`}
      >
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 dark:text-slate-500 hidden sm:inline truncate">
                {user.role === 'ADMIN'
                  ? 'Multi-Station Network'
                  : user.stationName
                  ? `${user.stationBrand || 'PetroDesk'} · ${user.stationName}`
                  : 'Station Operations'}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{currentNav?.label}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 shrink-0">
            <span className="hidden sm:inline whitespace-nowrap">
              {user.fullName} · {roleLabel(user.role)}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'}
              title={theme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Day' : 'Night'}</span>
            </button>
            {user.role !== 'ADMIN' && activeSection !== 'POS' && (
              <button
                type="button"
                onClick={() => setActiveSection('POS')}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
              >
                Open POS
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeSection === 'POS' && user.role !== 'ADMIN' && <PosTerminal />}
          {activeSection === 'SALES' && user.role !== 'ADMIN' && <SalesAndZReadingView currentUser={user} />}
          {activeSection === 'DASHBOARD' && (user.role === 'MANAGER' || user.role === 'ADMIN') && (
            <DashboardView onNavigate={user.role === 'MANAGER' ? setActiveSection : undefined} />
          )}
          {activeSection === 'INVENTORY' && user.role === 'MANAGER' && <InventoryView />}
          {activeSection === 'STATIONS' && user.role === 'ADMIN' && <StationsView />}
          {activeSection === 'STAFF' && user.role === 'ADMIN' && <StaffView currentUser={user} />}
        </main>
      </div>
    </div>
  );
}
