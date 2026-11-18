import type {
  AuthUser,
  DashboardAnalytics,
  FuelTank,
  InventoryAdjustment,
  PaymentMethod,
  PublicStation,
  Sale,
  StaffUser,
  Station,
  StoreItem,
  UserRole,
  ZReading,
  ZReadingPreview,
} from './types';

let authToken: string | null = null;

export function setApiToken(token: string | null) {
  authToken = token;
}

export function getApiToken(): string | null {
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(path, {
    cache: 'no-store',
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  listPublicStations() {
    return request<{ stations: PublicStation[] }>('/api/stations/public');
  },
  login(username: string, password: string) {
    return request<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  registerStation(payload: {
    stationCode?: string;
    brand: string;
    stationName: string;
    address: string;
    tin?: string;
    fullName: string;
    username: string;
    password: string;
    seedStarterInventory: boolean;
    createStarterCashier: boolean;
  }) {
    return request<{
      token: string;
      user: AuthUser;
      station: Station;
      generatedCashier: { username: string; password: string } | null;
    }>('/api/auth/register-station', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  registerStaff(payload: {
    stationId: number;
    fullName: string;
    username: string;
    password: string;
  }) {
    return request<{
      pending: boolean;
      message: string;
      user: { id: number; username: string; fullName: string; stationName: string; active: boolean };
    }>('/api/auth/register-staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  me() {
    return request<{ user: AuthUser }>('/api/auth/me');
  },
  getCatalog() {
    return request<{ tanks: FuelTank[]; storeItems: StoreItem[] }>('/api/pos/catalog');
  },
  createSale(payload: {
    lines: Array<{
      itemType: 'FUEL' | 'STORE';
      fuelTankId?: number;
      storeItemId?: number;
      inputMode?: 'LITERS' | 'PESOS';
      amount?: number;
      quantity?: number;
    }>;
    paymentMethod: PaymentMethod;
    pumpLabel: string;
    amountTendered: number;
  }) {
    return request<{ sale: Sale }>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  listSales(params?: { onlyOpen?: boolean; status?: string; search?: string; date?: string }) {
    const qs = new URLSearchParams();
    if (params?.onlyOpen) qs.set('onlyOpen', 'true');
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.date) qs.set('date', params.date);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ sales: Sale[] }>(`/api/sales${suffix}`);
  },
  voidSale(saleId: number) {
    return request<{ sale: Sale }>(`/api/sales/${saleId}/void`, { method: 'POST' });
  },
  getZReadingPreview() {
    return request<{ preview: ZReadingPreview }>('/api/z-reading/preview');
  },
  closeZReading(payload: { actualCashCount: number; notes: string }) {
    return request<{ zReading: ZReading }>('/api/z-reading/close', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  listZReadings() {
    return request<{ zReadings: ZReading[] }>('/api/z-readings');
  },
  getAnalytics(stationId?: number | 'all' | null) {
    const qs = stationId && stationId !== 'all' ? `?stationId=${stationId}` : '';
    return request<DashboardAnalytics>(`/api/dashboard/analytics${qs}`);
  },
  getInventory() {
    return request<{ tanks: FuelTank[]; storeItems: StoreItem[]; adjustments: InventoryAdjustment[] }>('/api/inventory');
  },
  createFuelTank(payload: {
    code: string;
    name: string;
    pricePerLiter: number;
    capacityLiters: number;
    currentLiters: number;
    reorderThresholdLiters: number;
  }) {
    return request<{ tank: FuelTank }>('/api/inventory/fuel', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  adjustFuelTank(id: number, payload: { deltaLiters?: number; targetLiters?: number; pricePerLiter?: number; reason?: string }) {
    return request<{ tank: FuelTank }>(`/api/inventory/fuel/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  createStoreItem(payload: {
    sku: string;
    name: string;
    category: string;
    unitPrice: number;
    stockQty: number;
    reorderLevel: number;
  }) {
    return request<{ item: StoreItem }>('/api/inventory/store', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateStoreItem(id: number, payload: { deltaQty?: number; unitPrice?: number; active?: boolean; reason?: string }) {
    return request<{ item: StoreItem }>(`/api/inventory/store/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  listStations() {
    return request<{ stations: Station[] }>('/api/stations');
  },
  createStation(payload: {
    code: string;
    name: string;
    brand: string;
    address: string;
    tin: string;
    seedStarterInventory: boolean;
    createDefaultStaff: boolean;
  }) {
    return request<{
      station: Station;
      generatedAccounts: Array<{ role: UserRole; username: string; password: string }>;
    }>('/api/stations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateStation(id: number, payload: { name?: string; brand?: string; address?: string; tin?: string; active?: boolean }) {
    return request<{ station: Station }>(`/api/stations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  listUsers() {
    return request<{ users: StaffUser[] }>('/api/users');
  },
  createUser(payload: { username: string; fullName: string; password: string; role: UserRole; stationId?: number | null }) {
    return request<{ user: StaffUser }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateUser(id: number, payload: { fullName?: string; role?: UserRole; stationId?: number | null; active?: boolean; password?: string }) {
    return request<{ user: StaffUser }>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
