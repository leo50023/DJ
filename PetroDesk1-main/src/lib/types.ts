export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER';
export type PaymentMethod = 'CASH' | 'CARD' | 'GCASH';
export type SaleStatus = 'COMPLETED' | 'VOIDED';
export type ItemType = 'FUEL' | 'STORE';

export interface Station {
  id: number;
  code: string;
  name: string;
  brand: string;
  address: string;
  tin: string;
  active: boolean;
  tankCount?: number;
  staffCount?: number;
  totalRevenue?: number;
  transactionCount?: number;
  createdAt?: string;
}

export interface PublicStation {
  id: number;
  code: string;
  name: string;
  brand: string;
  address: string;
  demoManagerUsername: string | null;
  demoCashierUsername: string | null;
}

export interface AuthUser {
  uid: number;
  username: string;
  fullName: string;
  role: UserRole;
  stationId: number | null;
  stationCode: string | null;
  stationName: string | null;
  stationBrand: string | null;
  stationAddress: string | null;
  stationTin: string | null;
}

export interface FuelTank {
  id: number;
  stationId: number;
  code: string;
  name: string;
  pricePerLiter: number;
  currentLiters: number;
  capacityLiters: number;
  reorderThresholdLiters: number;
}

export interface StoreItem {
  id: number;
  stationId: number;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  stockQty: number;
  reorderLevel: number;
  active: boolean;
}

export interface SaleItem {
  id: number;
  saleId: number;
  itemType: ItemType;
  fuelTankId: number | null;
  storeItemId: number | null;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface Sale {
  id: number;
  stationId: number;
  stationCode?: string;
  stationName?: string;
  stationBrand?: string;
  stationAddress?: string;
  stationTin?: string;
  receiptNo: string;
  cashierId: number;
  cashierName: string;
  pumpLabel: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  amountTendered: number;
  changeAmount: number;
  status: SaleStatus;
  zReadingId: number | null;
  createdAt: string;
  items?: SaleItem[];
}

export interface ZReadingPreview {
  openSaleIds: number[];
  transactionCount: number;
  voidedCount: number;
  fuelRevenue: number;
  storeRevenue: number;
  totalRevenue: number;
  totalVatableSales: number;
  totalVat: number;
  cashTotal: number;
  cardTotal: number;
  gcashTotal: number;
  totalFuelLiters: number;
  beginningOrNo: string;
  endingOrNo: string;
  periodStart: string;
  periodEnd: string;
  fuelBreakdown: Array<{ name: string; liters: number; revenue: number }>;
}

export interface ZReading {
  id: number;
  stationId: number;
  stationCode?: string;
  stationName?: string;
  stationBrand?: string;
  stationAddress?: string;
  stationTin?: string;
  readingNumber: string;
  closedById: number;
  closedByName: string;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  voidedCount: number;
  fuelRevenue: number;
  storeRevenue: number;
  totalRevenue: number;
  totalVatableSales: number;
  totalVat: number;
  cashTotal: number;
  cardTotal: number;
  gcashTotal: number;
  totalFuelLiters: number;
  beginningOrNo: string;
  endingOrNo: string;
  actualCashCount: number;
  cashVariance: number;
  notes: string;
  createdAt: string;
}

export interface StationBreakdownItem {
  stationId: number;
  code: string;
  name: string;
  brand: string;
  active: boolean;
  todayRevenue: number;
  weeklyRevenue: number;
  weeklyLiters: number;
  transactions: number;
  outOfGasCount: number;
  lowStockCount: number;
}

export interface DashboardAnalytics {
  selectedStationId: number | null;
  stations: Station[];
  stationBreakdown: StationBreakdownItem[];
  kpis: {
    todayRevenue: number;
    todayTransactions: number;
    todayLiters: number;
    openShiftTotal: number;
    openShiftCount: number;
    weeklyRevenue: number;
    weeklyFuelRevenue: number;
    weeklyStoreRevenue: number;
    weeklyLiters: number;
  };
  paymentBreakdown: {
    cash: number;
    card: number;
    gcash: number;
  };
  lowStockAlerts: Array<{
    stationId: number;
    stationName: string;
    itemType: 'FUEL' | 'STORE';
    name: string;
    remaining: string;
    threshold: string;
  }>;
  dailySeries: Array<{
    date: string;
    label: string;
    fuelRevenue: number;
    storeRevenue: number;
    totalRevenue: number;
    transactions: number;
    liters: number;
  }>;
  topFuel: Array<{ name: string; itemType: 'FUEL'; unit: string; quantity: number; revenue: number }>;
  topStore: Array<{ name: string; itemType: 'STORE'; unit: string; quantity: number; revenue: number }>;
}

export interface InventoryAdjustment {
  id: number;
  stationId: number;
  itemType: ItemType;
  refId: number;
  itemName: string;
  deltaQty: number;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface StaffUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  stationId: number | null;
  stationName?: string;
  stationCode?: string | null;
  active: boolean;
  createdAt: string;
}
