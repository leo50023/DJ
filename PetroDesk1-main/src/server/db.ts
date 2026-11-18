import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DataTypes, Sequelize } from 'sequelize';
import type { Model, ModelStatic } from 'sequelize';
import { sqliteDialectModule } from './sqliteAdapter.ts';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'petrodesk.sqlite');

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  dialectModule: sqliteDialectModule,
  storage: dbPath,
  logging: false,
});

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER';
export type PaymentMethod = 'CASH' | 'CARD' | 'GCASH';
export type SaleStatus = 'COMPLETED' | 'VOIDED';
export type ItemType = 'FUEL' | 'STORE';

export interface StationAttrs {
  id?: number;
  code: string;
  name: string;
  brand: string;
  address: string;
  tin: string;
  active: boolean;
}

export interface UserAttrs {
  id?: number;
  username: string;
  fullName: string;
  passwordHash: string;
  role: UserRole;
  stationId: number | null;
  active: boolean;
}

export interface FuelTankAttrs {
  id?: number;
  stationId: number;
  code: string;
  name: string;
  pricePerLiter: number;
  currentLiters: number;
  capacityLiters: number;
  reorderThresholdLiters: number;
}

export interface StoreItemAttrs {
  id?: number;
  stationId: number;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  stockQty: number;
  reorderLevel: number;
  active: boolean;
}

export interface SaleAttrs {
  id?: number;
  stationId: number;
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
  createdAt?: Date;
}

export interface SaleItemAttrs {
  id?: number;
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

export interface InventoryAdjustmentAttrs {
  id?: number;
  stationId: number;
  itemType: ItemType;
  refId: number;
  itemName: string;
  deltaQty: number;
  reason: string;
  performedBy: string;
  createdAt?: Date;
}

export interface ZReadingAttrs {
  id?: number;
  stationId: number;
  readingNumber: string;
  closedById: number;
  closedByName: string;
  periodStart: Date;
  periodEnd: Date;
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
  createdAt?: Date;
}

export const StationModel = sequelize.define<Model<StationAttrs>>(
  'Station',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(24), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    brand: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'PetroDesk' },
    address: { type: DataTypes.STRING(200), allowNull: false },
    tin: { type: DataTypes.STRING(60), allowNull: false, defaultValue: '009-482-110-000' },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: 'stations', timestamps: true }
);

export const UserModel = sequelize.define<Model<UserAttrs>>(
  'User',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    fullName: { type: DataTypes.STRING(120), allowNull: false },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'CASHIER' },
    stationId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: 'users', timestamps: true }
);

export const FuelTankModel = sequelize.define<Model<FuelTankAttrs>>(
  'FuelTank',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    stationId: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    code: { type: DataTypes.STRING(24), allowNull: false },
    name: { type: DataTypes.STRING(80), allowNull: false },
    pricePerLiter: { type: DataTypes.FLOAT, allowNull: false },
    currentLiters: { type: DataTypes.FLOAT, allowNull: false },
    capacityLiters: { type: DataTypes.FLOAT, allowNull: false },
    reorderThresholdLiters: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 3000 },
  },
  {
    tableName: 'fuel_tanks',
    timestamps: true,
    indexes: [{ unique: true, fields: ['stationId', 'code'] }],
  }
);

export const StoreItemModel = sequelize.define<Model<StoreItemAttrs>>(
  'StoreItem',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    stationId: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    sku: { type: DataTypes.STRING(40), allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    category: { type: DataTypes.STRING(60), allowNull: false },
    unitPrice: { type: DataTypes.FLOAT, allowNull: false },
    stockQty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    reorderLevel: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: 'store_items',
    timestamps: true,
    indexes: [{ unique: true, fields: ['stationId', 'sku'] }],
  }
);

export const ZReadingModel = sequelize.define<Model<ZReadingAttrs>>(
  'ZReading',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    stationId: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    readingNumber: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    closedById: { type: DataTypes.INTEGER, allowNull: false },
    closedByName: { type: DataTypes.STRING(120), allowNull: false },
    periodStart: { type: DataTypes.DATE, allowNull: false },
    periodEnd: { type: DataTypes.DATE, allowNull: false },
    transactionCount: { type: DataTypes.INTEGER, allowNull: false },
    voidedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    fuelRevenue: { type: DataTypes.FLOAT, allowNull: false },
    storeRevenue: { type: DataTypes.FLOAT, allowNull: false },
    totalRevenue: { type: DataTypes.FLOAT, allowNull: false },
    totalVatableSales: { type: DataTypes.FLOAT, allowNull: false },
    totalVat: { type: DataTypes.FLOAT, allowNull: false },
    cashTotal: { type: DataTypes.FLOAT, allowNull: false },
    cardTotal: { type: DataTypes.FLOAT, allowNull: false },
    gcashTotal: { type: DataTypes.FLOAT, allowNull: false },
    totalFuelLiters: { type: DataTypes.FLOAT, allowNull: false },
    beginningOrNo: { type: DataTypes.STRING(40), allowNull: false },
    endingOrNo: { type: DataTypes.STRING(40), allowNull: false },
    actualCashCount: { type: DataTypes.FLOAT, allowNull: false },
    cashVariance: { type: DataTypes.FLOAT, allowNull: false },
    notes: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
  },
  { tableName: 'z_readings', timestamps: true }
);

export const SaleModel = sequelize.define<Model<SaleAttrs>>(
  'Sale',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    stationId: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    receiptNo: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    cashierId: { type: DataTypes.INTEGER, allowNull: false },
    cashierName: { type: DataTypes.STRING(120), allowNull: false },
    pumpLabel: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'Island 1 · Pump A' },
    paymentMethod: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'CASH' },
    subtotal: { type: DataTypes.FLOAT, allowNull: false },
    vatAmount: { type: DataTypes.FLOAT, allowNull: false },
    totalAmount: { type: DataTypes.FLOAT, allowNull: false },
    amountTendered: { type: DataTypes.FLOAT, allowNull: false },
    changeAmount: { type: DataTypes.FLOAT, allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'COMPLETED' },
    zReadingId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
  },
  { tableName: 'sales', timestamps: true }
);

export const SaleItemModel = sequelize.define<Model<SaleItemAttrs>>(
  'SaleItem',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    saleId: { type: DataTypes.INTEGER, allowNull: false },
    itemType: { type: DataTypes.STRING(16), allowNull: false },
    fuelTankId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    storeItemId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    itemName: { type: DataTypes.STRING(120), allowNull: false },
    quantity: { type: DataTypes.FLOAT, allowNull: false },
    unit: { type: DataTypes.STRING(16), allowNull: false },
    unitPrice: { type: DataTypes.FLOAT, allowNull: false },
    lineTotal: { type: DataTypes.FLOAT, allowNull: false },
  },
  { tableName: 'sale_items', timestamps: true }
);

export const InventoryAdjustmentModel = sequelize.define<Model<InventoryAdjustmentAttrs>>(
  'InventoryAdjustment',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    stationId: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    itemType: { type: DataTypes.STRING(16), allowNull: false },
    refId: { type: DataTypes.INTEGER, allowNull: false },
    itemName: { type: DataTypes.STRING(120), allowNull: false },
    deltaQty: { type: DataTypes.FLOAT, allowNull: false },
    reason: { type: DataTypes.STRING(200), allowNull: false },
    performedBy: { type: DataTypes.STRING(120), allowNull: false },
  },
  { tableName: 'inventory_adjustments', timestamps: true }
);

// Associations
StationModel.hasMany(UserModel, { foreignKey: 'stationId', as: 'users' });
UserModel.belongsTo(StationModel, { foreignKey: 'stationId', as: 'station' });
StationModel.hasMany(FuelTankModel, { foreignKey: 'stationId', as: 'tanks' });
FuelTankModel.belongsTo(StationModel, { foreignKey: 'stationId', as: 'station' });
StationModel.hasMany(StoreItemModel, { foreignKey: 'stationId', as: 'storeItems' });
StoreItemModel.belongsTo(StationModel, { foreignKey: 'stationId', as: 'station' });
StationModel.hasMany(SaleModel, { foreignKey: 'stationId', as: 'sales' });
SaleModel.belongsTo(StationModel, { foreignKey: 'stationId', as: 'station' });
StationModel.hasMany(ZReadingModel, { foreignKey: 'stationId', as: 'zReadings' });
ZReadingModel.belongsTo(StationModel, { foreignKey: 'stationId', as: 'station' });

SaleModel.hasMany(SaleItemModel, { foreignKey: 'saleId', as: 'items' });
SaleItemModel.belongsTo(SaleModel, { foreignKey: 'saleId', as: 'sale' });
UserModel.hasMany(SaleModel, { foreignKey: 'cashierId', as: 'sales' });
SaleModel.belongsTo(UserModel, { foreignKey: 'cashierId', as: 'cashier' });
ZReadingModel.hasMany(SaleModel, { foreignKey: 'zReadingId', as: 'sales' });
SaleModel.belongsTo(ZReadingModel, { foreignKey: 'zReadingId', as: 'zReading' });

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function formatDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

export async function seedStarterInventoryForStation(
  stationId: number,
  options?: { priceOffset?: number; lowDiesel?: boolean }
) {
  const offset = options?.priceOffset ?? 0;
  const unleaded = await FuelTankModel.create({
    stationId,
    code: 'UNL-91',
    name: 'Unleaded 91',
    pricePerLiter: round2(58.4 + offset),
    currentLiters: 14250.5,
    capacityLiters: 20000,
    reorderThresholdLiters: 4000,
  });
  const premium = await FuelTankModel.create({
    stationId,
    code: 'PRM-95',
    name: 'Premium 95',
    pricePerLiter: round2(63.9 + offset),
    currentLiters: 11840.25,
    capacityLiters: 20000,
    reorderThresholdLiters: 4000,
  });
  const diesel = await FuelTankModel.create({
    stationId,
    code: 'DSL-01',
    name: 'Diesel',
    pricePerLiter: round2(55.2 + offset),
    currentLiters: options?.lowDiesel ? 2400 : 16920.0,
    capacityLiters: 25000,
    reorderThresholdLiters: 5000,
  });

  const storeSeed: StoreItemAttrs[] = [
    { stationId, sku: 'LUB-10W40', name: '10W-40 Motor Oil (1L)', category: 'Lubricants', unitPrice: 345, stockQty: 42, reorderLevel: 12, active: true },
    { stationId, sku: 'LUB-2T', name: '2T Motorcycle Oil (200ml)', category: 'Lubricants', unitPrice: 95, stockQty: 64, reorderLevel: 15, active: true },
    { stationId, sku: 'AUTO-COOL', name: 'Radiator Coolant Premix (1L)', category: 'Auto Care', unitPrice: 220, stockQty: 19, reorderLevel: 8, active: true },
    { stationId, sku: 'AUTO-WASH', name: 'Windshield Washer Fluid', category: 'Auto Care', unitPrice: 165, stockQty: 14, reorderLevel: 6, active: true },
    { stationId, sku: 'BEV-WTR500', name: 'Purified Water (500ml)', category: 'Beverages', unitPrice: 25, stockQty: 120, reorderLevel: 24, active: true },
    { stationId, sku: 'BEV-COF', name: 'Iced Espresso Can (240ml)', category: 'Beverages', unitPrice: 65, stockQty: 48, reorderLevel: 12, active: true },
    { stationId, sku: 'BEV-ENG', name: 'Electrolyte Sports Drink', category: 'Beverages', unitPrice: 55, stockQty: 38, reorderLevel: 12, active: true },
    { stationId, sku: 'SNK-NUTS', name: 'Roasted Peanuts Pack', category: 'Snacks', unitPrice: 35, stockQty: 52, reorderLevel: 15, active: true },
  ];
  const storeItems = await StoreItemModel.bulkCreate(storeSeed);
  return { tanks: [unleaded, premium, diesel], storeItems };
}

async function ensureMultiStationColumnsAndIndexes() {
  const addColumnIfMissing = async (table: string, colDef: string, colName: string) => {
    const [cols] = (await sequelize.query(`PRAGMA table_info(${table})`)) as [Array<{ name: string }>, unknown];
    if (cols.length === 0) return;
    if (!cols.some((c) => c.name === colName)) {
      await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
    }
  };

  await addColumnIfMissing('users', 'stationId INTEGER DEFAULT NULL', 'stationId');
  await addColumnIfMissing('fuel_tanks', 'stationId INTEGER NOT NULL DEFAULT 1', 'stationId');
  await addColumnIfMissing('store_items', 'stationId INTEGER NOT NULL DEFAULT 1', 'stationId');
  await addColumnIfMissing('sales', 'stationId INTEGER NOT NULL DEFAULT 1', 'stationId');
  await addColumnIfMissing('z_readings', 'stationId INTEGER NOT NULL DEFAULT 1', 'stationId');
  await addColumnIfMissing('inventory_adjustments', 'stationId INTEGER NOT NULL DEFAULT 1', 'stationId');

  // If fuel_tanks was created with legacy single-column UNIQUE(code), rebuild cleanly to UNIQUE(stationId, code)
  const [fuelTableRows] = (await sequelize.query(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='fuel_tanks'`
  )) as [Array<{ sql?: string }>, unknown];
  const fuelSql = fuelTableRows[0]?.sql || '';
  if (/\bcode\b[^,]*UNIQUE/i.test(fuelSql)) {
    await sequelize.query('PRAGMA foreign_keys = OFF');
    await sequelize.query(`
      CREATE TABLE fuel_tanks_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stationId INTEGER NOT NULL DEFAULT 1,
        code VARCHAR(24) NOT NULL,
        name VARCHAR(80) NOT NULL,
        pricePerLiter FLOAT NOT NULL,
        currentLiters FLOAT NOT NULL,
        capacityLiters FLOAT NOT NULL,
        reorderThresholdLiters FLOAT NOT NULL DEFAULT 3000,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      )
    `);
    await sequelize.query(`
      INSERT INTO fuel_tanks_new (id, stationId, code, name, pricePerLiter, currentLiters, capacityLiters, reorderThresholdLiters, createdAt, updatedAt)
      SELECT id, COALESCE(stationId, 1), code, name, pricePerLiter, currentLiters, capacityLiters, reorderThresholdLiters, createdAt, updatedAt FROM fuel_tanks
    `);
    await sequelize.query('DROP TABLE fuel_tanks');
    await sequelize.query('ALTER TABLE fuel_tanks_new RENAME TO fuel_tanks');
    await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS fuel_tanks_station_id_code ON fuel_tanks(stationId, code)');
    await sequelize.query('PRAGMA foreign_keys = ON');
  }

  // If store_items was created with legacy single-column UNIQUE(sku), rebuild cleanly to UNIQUE(stationId, sku)
  const [storeTableRows] = (await sequelize.query(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='store_items'`
  )) as [Array<{ sql?: string }>, unknown];
  const storeSql = storeTableRows[0]?.sql || '';
  if (/\bsku\b[^,]*UNIQUE/i.test(storeSql)) {
    await sequelize.query('PRAGMA foreign_keys = OFF');
    await sequelize.query(`
      CREATE TABLE store_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stationId INTEGER NOT NULL DEFAULT 1,
        sku VARCHAR(40) NOT NULL,
        name VARCHAR(120) NOT NULL,
        category VARCHAR(60) NOT NULL,
        unitPrice FLOAT NOT NULL,
        stockQty INTEGER NOT NULL DEFAULT 0,
        reorderLevel INTEGER NOT NULL DEFAULT 10,
        active TINYINT(1) NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      )
    `);
    await sequelize.query(`
      INSERT INTO store_items_new (id, stationId, sku, name, category, unitPrice, stockQty, reorderLevel, active, createdAt, updatedAt)
      SELECT id, COALESCE(stationId, 1), sku, name, category, unitPrice, stockQty, reorderLevel, active, createdAt, updatedAt FROM store_items
    `);
    await sequelize.query('DROP TABLE store_items');
    await sequelize.query('ALTER TABLE store_items_new RENAME TO store_items');
    await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS store_items_station_id_sku ON store_items(stationId, sku)');
    await sequelize.query('PRAGMA foreign_keys = ON');
  }
}

let initPromise: Promise<void> | null = null;

export async function initializeDatabase(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await ensureMultiStationColumnsAndIndexes();
    await sequelize.sync();

    const stationCount = await StationModel.count();
    let station1Id = 1;
    let station2Id = 2;
    let station3Id = 3;

    if (stationCount === 0) {
      const s1 = await StationModel.create({
        code: 'STN-01',
        name: 'San Isidro Main',
        brand: 'PetroDesk',
        address: 'National Highway, Brgy. San Isidro',
        tin: '009-482-110-001',
        active: true,
      });
      const s2 = await StationModel.create({
        code: 'STN-02',
        name: 'North Diversion',
        brand: 'Petron',
        address: 'North Diversion Rd, Brgy. Mabuhay',
        tin: '009-482-110-002',
        active: true,
      });
      const s3 = await StationModel.create({
        code: 'STN-03',
        name: 'South Terminal',
        brand: 'Shell',
        address: 'South Expressway Exit, Brgy. Santo Tomas',
        tin: '009-482-110-003',
        active: true,
      });
      station1Id = s1.get('id') as number;
      station2Id = s2.get('id') as number;
      station3Id = s3.get('id') as number;
    } else {
      const allStations = await StationModel.findAll({ order: [['id', 'ASC']] });
      station1Id = (allStations[0]?.get('id') as number) || 1;
      station2Id = (allStations[1]?.get('id') as number) || 2;
      station3Id = (allStations[2]?.get('id') as number) || 3;
    }

    const userCount = await UserModel.count();

    if (userCount > 0) {
      // Existing DB upgrade path: attach existing station-1 staff & seed Station 2/3 if missing
      await UserModel.update({ stationId: null }, { where: { role: 'ADMIN' } });
      await UserModel.update({ stationId: station1Id }, { where: { role: ['MANAGER', 'CASHIER'], stationId: null } });
    } else {
      // Fresh DB Seed: Users for Station 1, 2, 3 + Network Admin
      await UserModel.create({
        username: 'admin',
        fullName: 'Elena Reyes',
        passwordHash: hashPassword('admin123'),
        role: 'ADMIN',
        stationId: null,
        active: true,
      });
      const manager = await UserModel.create({
        username: 'manager',
        fullName: 'Marco Santos',
        passwordHash: hashPassword('manager123'),
        role: 'MANAGER',
        stationId: station1Id,
        active: true,
      });
      const cashier = await UserModel.create({
        username: 'cashier',
        fullName: 'Jessa Cruz',
        passwordHash: hashPassword('cashier123'),
        role: 'CASHIER',
        stationId: station1Id,
        active: true,
      });

      const s1Seed = await seedStarterInventoryForStation(station1Id);
      const tanks = s1Seed.tanks;
      const storeItems = s1Seed.storeItems;
      const now = new Date();
      let seq = 1;

      const createSeedSale = async (
        targetStationId: number,
        stationCode: string,
        stationTanks: Model<FuelTankAttrs>[],
        stationStore: Model<StoreItemAttrs>[],
        daysAgo: number,
        hour: number,
        minute: number,
        tankIdx: number,
        pesosFuel: number,
        storeIdx: number | null,
        storeQty: number,
        paymentMethod: PaymentMethod,
        pumpLabel: string,
        zReadingId: number | null,
        cashierUser: Model<UserAttrs>
      ) => {
        const dt = new Date(now);
        dt.setDate(dt.getDate() - daysAgo);
        dt.setHours(hour, minute, 0, 0);

        const tank = stationTanks[tankIdx];
        const tankData = tank.get({ plain: true });
        const liters = round3(pesosFuel / tankData.pricePerLiter);
        const fuelTotal = round2(pesosFuel);

        let totalAmount = fuelTotal;
        const itemsToCreate: Omit<SaleItemAttrs, 'saleId'>[] = [
          {
            itemType: 'FUEL',
            fuelTankId: tankData.id!,
            storeItemId: null,
            itemName: tankData.name,
            quantity: liters,
            unit: 'L',
            unitPrice: tankData.pricePerLiter,
            lineTotal: fuelTotal,
          },
        ];

        if (storeIdx !== null && storeQty > 0) {
          const sData = stationStore[storeIdx].get({ plain: true });
          const sLine = round2(sData.unitPrice * storeQty);
          totalAmount = round2(totalAmount + sLine);
          itemsToCreate.push({
            itemType: 'STORE',
            fuelTankId: null,
            storeItemId: sData.id!,
            itemName: sData.name,
            quantity: storeQty,
            unit: 'pc',
            unitPrice: sData.unitPrice,
            lineTotal: sLine,
          });
        }

        const vatable = round2(totalAmount / 1.12);
        const vatAmount = round2(totalAmount - vatable);
        const receiptNo = `OR-${stationCode}-${formatDateKey(dt)}-${String(seq++).padStart(4, '0')}`;

        const sale = await SaleModel.create({
          stationId: targetStationId,
          receiptNo,
          cashierId: cashierUser.get('id') as number,
          cashierName: cashierUser.get('fullName') as string,
          pumpLabel,
          paymentMethod,
          subtotal: vatable,
          vatAmount,
          totalAmount,
          amountTendered: totalAmount,
          changeAmount: 0,
          status: 'COMPLETED',
          zReadingId,
          createdAt: dt,
        });

        const saleId = sale.get('id') as number;
        for (const item of itemsToCreate) {
          await SaleItemModel.create({ ...item, saleId });
        }
        return sale;
      };

      // Station 1 historical Z-readings + open shift sales
      const z1PeriodStart = new Date(now);
      z1PeriodStart.setDate(z1PeriodStart.getDate() - 6);
      z1PeriodStart.setHours(6, 0, 0, 0);
      const z1PeriodEnd = new Date(now);
      z1PeriodEnd.setDate(z1PeriodEnd.getDate() - 4);
      z1PeriodEnd.setHours(22, 0, 0, 0);

      const z1 = await ZReadingModel.create({
        stationId: station1Id,
        readingNumber: `Z-STN01-${formatDateKey(z1PeriodEnd)}-001`,
        closedById: manager.get('id') as number,
        closedByName: manager.get('fullName') as string,
        periodStart: z1PeriodStart,
        periodEnd: z1PeriodEnd,
        transactionCount: 9,
        voidedCount: 0,
        fuelRevenue: 13850,
        storeRevenue: 1180,
        totalRevenue: 15030,
        totalVatableSales: round2(15030 / 1.12),
        totalVat: round2(15030 - 15030 / 1.12),
        cashTotal: 9630,
        cardTotal: 3400,
        gcashTotal: 2000,
        totalFuelLiters: 238.45,
        beginningOrNo: `OR-STN01-${formatDateKey(z1PeriodStart)}-0001`,
        endingOrNo: `OR-STN01-${formatDateKey(z1PeriodEnd)}-0009`,
        actualCashCount: 9630,
        cashVariance: 0,
        notes: 'Closed cleanly. All pump meter checks matched.',
        createdAt: z1PeriodEnd,
      });
      const z1Id = z1.get('id') as number;

      const z1Configs: Array<[number, number, number, number, number, number | null, number, PaymentMethod, string]> = [
        [6, 8, 15, 0, 1000, 4, 2, 'CASH', 'Island 1 · Pump A'],
        [6, 11, 40, 2, 2200, 0, 1, 'CARD', 'Island 2 · Pump A'],
        [6, 16, 20, 1, 1500, null, 0, 'GCASH', 'Island 1 · Pump B'],
        [5, 9, 10, 2, 2500, 5, 2, 'CASH', 'Island 2 · Pump B'],
        [5, 14, 35, 0, 1200, 2, 1, 'CARD', 'Island 1 · Pump A'],
        [5, 18, 50, 1, 1800, null, 0, 'CASH', 'Island 1 · Pump B'],
        [4, 7, 45, 0, 850, 7, 2, 'CASH', 'Island 1 · Pump A'],
        [4, 13, 25, 2, 2000, 1, 2, 'CASH', 'Island 2 · Pump A'],
        [4, 19, 15, 1, 800, 6, 1, 'GCASH', 'Island 1 · Pump B'],
      ];
      for (const c of z1Configs) {
        await createSeedSale(station1Id, 'STN01', tanks, storeItems, c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], z1Id, cashier);
      }

      const z2PeriodStart = new Date(now);
      z2PeriodStart.setDate(z2PeriodStart.getDate() - 3);
      z2PeriodStart.setHours(6, 0, 0, 0);
      const z2PeriodEnd = new Date(now);
      z2PeriodEnd.setDate(z2PeriodEnd.getDate() - 1);
      z2PeriodEnd.setHours(22, 0, 0, 0);

      const z2 = await ZReadingModel.create({
        stationId: station1Id,
        readingNumber: `Z-STN01-${formatDateKey(z2PeriodEnd)}-002`,
        closedById: manager.get('id') as number,
        closedByName: manager.get('fullName') as string,
        periodStart: z2PeriodStart,
        periodEnd: z2PeriodEnd,
        transactionCount: 9,
        voidedCount: 0,
        fuelRevenue: 15900,
        storeRevenue: 1320,
        totalRevenue: 17220,
        totalVatableSales: round2(17220 / 1.12),
        totalVat: round2(17220 - 17220 / 1.12),
        cashTotal: 10920,
        cardTotal: 4200,
        gcashTotal: 2100,
        totalFuelLiters: 274.12,
        beginningOrNo: `OR-STN01-${formatDateKey(z2PeriodStart)}-0010`,
        endingOrNo: `OR-STN01-${formatDateKey(z2PeriodEnd)}-0018`,
        actualCashCount: 10920,
        cashVariance: 0,
        notes: 'Verified evening deposit and lube shelf restock.',
        createdAt: z2PeriodEnd,
      });
      const z2Id = z2.get('id') as number;

      const z2Configs: Array<[number, number, number, number, number, number | null, number, PaymentMethod, string]> = [
        [3, 8, 25, 2, 2400, 0, 1, 'CASH', 'Island 2 · Pump A'],
        [3, 12, 10, 0, 1100, 4, 2, 'GCASH', 'Island 1 · Pump A'],
        [3, 17, 45, 1, 1600, null, 0, 'CARD', 'Island 1 · Pump B'],
        [2, 9, 30, 0, 1400, 5, 2, 'CASH', 'Island 1 · Pump A'],
        [2, 14, 15, 2, 2600, 3, 1, 'CARD', 'Island 2 · Pump B'],
        [2, 18, 20, 1, 1200, null, 0, 'CASH', 'Island 1 · Pump B'],
        [1, 7, 55, 0, 1500, 1, 2, 'CASH', 'Island 1 · Pump A'],
        [1, 13, 40, 2, 2300, 6, 2, 'CASH', 'Island 2 · Pump A'],
        [1, 20, 10, 1, 1800, 2, 1, 'GCASH', 'Island 1 · Pump B'],
      ];
      for (const c of z2Configs) {
        await createSeedSale(station1Id, 'STN01', tanks, storeItems, c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], z2Id, cashier);
      }

      const todayConfigs: Array<[number, number, number, number, number, number | null, number, PaymentMethod, string]> = [
        [0, 7, 12, 0, 1000, 5, 1, 'CASH', 'Island 1 · Pump A'],
        [0, 8, 34, 2, 2500, 0, 1, 'CARD', 'Island 2 · Pump A'],
        [0, 9, 48, 1, 1500, 4, 2, 'GCASH', 'Island 1 · Pump B'],
        [0, 11, 15, 0, 500, null, 0, 'CASH', 'Island 1 · Pump A'],
        [0, 12, 5, 2, 1800, 6, 1, 'CASH', 'Island 2 · Pump B'],
      ];
      for (const c of todayConfigs) {
        await createSeedSale(station1Id, 'STN01', tanks, storeItems, c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], null, cashier);
      }

      await InventoryAdjustmentModel.bulkCreate([
        {
          stationId: station1Id,
          itemType: 'FUEL',
          refId: tanks[0].get('id') as number,
          itemName: 'Unleaded 91',
          deltaQty: 8000,
          reason: 'Tanker Delivery · Manifest #TD-8841',
          performedBy: manager.get('fullName') as string,
        },
        {
          stationId: station1Id,
          itemType: 'FUEL',
          refId: tanks[2].get('id') as number,
          itemName: 'Diesel',
          deltaQty: 10000,
          reason: 'Tanker Delivery · Manifest #TD-8842',
          performedBy: manager.get('fullName') as string,
        },
        {
          stationId: station1Id,
          itemType: 'STORE',
          refId: storeItems[0].get('id') as number,
          itemName: '10W-40 Motor Oil (1L)',
          deltaQty: 24,
          reason: 'Supplier Restock · Inv #LUB-209',
          performedBy: manager.get('fullName') as string,
        },
      ]);
    }

    // Seed Station 2 and Station 3 staff, inventory, and sample sales if not present yet
    const ensureBranchSeed = async (
      targetStationId: number,
      branchCode: string,
      mgrUsername: string,
      mgrName: string,
      cshUsername: string,
      cshName: string,
      priceOffset: number,
      lowDiesel: boolean
    ) => {
      let mgr = await UserModel.findOne({ where: { username: mgrUsername } });
      if (!mgr) {
        mgr = await UserModel.create({
          username: mgrUsername,
          fullName: mgrName,
          passwordHash: hashPassword('manager123'),
          role: 'MANAGER',
          stationId: targetStationId,
          active: true,
        });
      }
      let csh = await UserModel.findOne({ where: { username: cshUsername } });
      if (!csh) {
        csh = await UserModel.create({
          username: cshUsername,
          fullName: cshName,
          passwordHash: hashPassword('cashier123'),
          role: 'CASHIER',
          stationId: targetStationId,
          active: true,
        });
      }

      const tankCount = await FuelTankModel.count({ where: { stationId: targetStationId } });
      if (tankCount === 0) {
        const { tanks, storeItems } = await seedStarterInventoryForStation(targetStationId, { priceOffset, lowDiesel });
        const branchSalesCount = await SaleModel.count({ where: { stationId: targetStationId } });
        if (branchSalesCount === 0) {
          const now = new Date();
          const samples: Array<[number, number, number, number, number, number | null, number, PaymentMethod]> = [
            [2, 9, 20, 0, 1200, 4, 2, 'CASH'],
            [1, 14, 15, 2, 2200, 0, 1, 'CARD'],
            [0, 8, 45, 1, 1500, 5, 1, 'GCASH'],
            [0, 10, 30, 0, 900, null, 0, 'CASH'],
          ];
          for (let idx = 0; idx < samples.length; idx++) {
            const [daysAgo, hour, minute, tankIdx, pesosFuel, storeIdx, storeQty, paymentMethod] = samples[idx];
            const dt = new Date(now);
            dt.setDate(dt.getDate() - daysAgo);
            dt.setHours(hour, minute, 0, 0);
            const t = tanks[tankIdx].get({ plain: true });
            const liters = round3(pesosFuel / t.pricePerLiter);
            let totalAmount = round2(pesosFuel);
            const lines: Omit<SaleItemAttrs, 'saleId'>[] = [
              {
                itemType: 'FUEL',
                fuelTankId: t.id!,
                storeItemId: null,
                itemName: t.name,
                quantity: liters,
                unit: 'L',
                unitPrice: t.pricePerLiter,
                lineTotal: totalAmount,
              },
            ];
            if (storeIdx !== null && storeQty > 0) {
              const s = storeItems[storeIdx].get({ plain: true });
              const sLine = round2(s.unitPrice * storeQty);
              totalAmount = round2(totalAmount + sLine);
              lines.push({
                itemType: 'STORE',
                fuelTankId: null,
                storeItemId: s.id!,
                itemName: s.name,
                quantity: storeQty,
                unit: 'pc',
                unitPrice: s.unitPrice,
                lineTotal: sLine,
              });
            }
            const vatable = round2(totalAmount / 1.12);
            const vatAmount = round2(totalAmount - vatable);
            const sale = await SaleModel.create({
              stationId: targetStationId,
              receiptNo: `OR-${branchCode}-${formatDateKey(dt)}-${String(idx + 1).padStart(4, '0')}`,
              cashierId: csh.get('id') as number,
              cashierName: csh.get('fullName') as string,
              pumpLabel: 'Island 1 · Pump A',
              paymentMethod,
              subtotal: vatable,
              vatAmount,
              totalAmount,
              amountTendered: totalAmount,
              changeAmount: 0,
              status: 'COMPLETED',
              zReadingId: null,
              createdAt: dt,
            });
            const saleId = sale.get('id') as number;
            for (const item of lines) {
              await SaleItemModel.create({ ...item, saleId });
            }
          }
        }
      }
    };

    await ensureBranchSeed(station2Id, 'STN02', 'manager2', 'Paolo Mendoza', 'cashier2', 'Liza Navarro', 0.5, true);
    await ensureBranchSeed(station3Id, 'STN03', 'manager3', 'Carlo Dizon', 'cashier3', 'Bea Villanueva', 1.1, false);
  })();

  return initPromise;
}

export type { ModelStatic };
