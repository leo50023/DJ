import { Router } from 'express';
import { Op } from 'sequelize';
import { buildAuthUserInfo, requireAuth, requireRole, signToken } from './auth.ts';
import type { AuthenticatedRequest } from './auth.ts';
import {
  FuelTankModel,
  InventoryAdjustmentModel,
  SaleItemModel,
  SaleModel,
  StationModel,
  StoreItemModel,
  UserModel,
  ZReadingModel,
  hashPassword,
  seedStarterInventoryForStation,
  sequelize,
  verifyPassword,
} from './db.ts';
import type { PaymentMethod, UserRole } from './db.ts';

export const apiRouter = Router();

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

function formatDayIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function getStationMap() {
  const stations = await StationModel.findAll({ order: [['id', 'ASC']] });
  const map = new Map<number, { id: number; code: string; name: string; brand: string; address: string; tin: string; active: boolean }>();
  for (const s of stations) {
    const plain = s.get({ plain: true }) as unknown as {
      id: number;
      code: string;
      name: string;
      brand: string;
      address: string;
      tin: string;
      active: boolean;
    };
    map.set(plain.id, plain);
  }
  return map;
}

function enrichWithStation<T extends { stationId?: number }>(
  row: T,
  stationMap: Map<number, { code: string; name: string; brand: string; address: string; tin: string }>
) {
  const st = row.stationId ? stationMap.get(row.stationId) : undefined;
  return {
    ...row,
    stationCode: st?.code || 'STN-01',
    stationName: st?.name || 'Main Station',
    stationBrand: st?.brand || 'PetroDesk',
    stationAddress: st?.address || '',
    stationTin: st?.tin || '',
  };
}

// Public station list for Sign-In branch selector
apiRouter.get('/stations/public', async (_req, res) => {
  try {
    const stations = await StationModel.findAll({
      where: { active: true },
      order: [['id', 'ASC']],
    });
    const users = await UserModel.findAll({
      where: { active: true, role: ['MANAGER', 'CASHIER'] },
      attributes: ['username', 'role', 'stationId'],
      order: [['id', 'ASC']],
    });

    const plainUsers = users.map((u) => u.get({ plain: true }) as unknown as { username: string; role: UserRole; stationId: number | null });

    const list = stations.map((s) => {
      const st = s.get({ plain: true }) as unknown as { id: number; code: string; name: string; brand: string; address: string };
      const mgr = plainUsers.find((u) => u.stationId === st.id && u.role === 'MANAGER');
      const csh = plainUsers.find((u) => u.stationId === st.id && u.role === 'CASHIER');
      return {
        id: st.id,
        code: st.code,
        name: st.name,
        brand: st.brand,
        address: st.address,
        demoManagerUsername: mgr?.username || null,
        demoCashierUsername: csh?.username || null,
      };
    });

    res.json({ stations: list });
  } catch (err) {
    console.error('Public stations error:', err);
    res.status(500).json({ error: 'Failed to load gas stations.' });
  }
});

// Auth
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const user = await UserModel.findOne({ where: { username } });
    if (!user || !verifyPassword(password, user.get('passwordHash') as string)) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }
    if (!user.get('active')) {
      res.status(403).json({ error: 'Account is pending approval or deactivated. Contact an administrator.' });
      return;
    }

    const authUser = await buildAuthUserInfo(user);
    if (authUser.role !== 'ADMIN' && authUser.stationId === null) {
      res.status(403).json({ error: 'Account is not assigned to any gas station.' });
      return;
    }
    if (authUser.stationId !== null) {
      const station = await StationModel.findByPk(authUser.stationId);
      if (!station || !station.get('active')) {
        res.status(403).json({ error: 'Assigned gas station is currently inactive.' });
        return;
      }
    }

    const token = signToken(authUser);
    res.json({ token, user: authUser });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Failed to sign in.' });
  }
});

// Public Self-Registration: Onboard a new Gas Station + Station Manager account
apiRouter.post('/auth/register-station', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const rawCode = String(req.body?.stationCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const stationName = String(req.body?.stationName || '').trim();
    const brand = String(req.body?.brand || '').trim() || 'PetroDesk';
    const address = String(req.body?.address || '').trim();
    const tin = String(req.body?.tin || '').trim() || '009-482-110-000';

    const fullName = String(req.body?.fullName || '').trim();
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const seedStarter = req.body?.seedStarterInventory !== false;
    const createStarterCashier = Boolean(req.body?.createStarterCashier);

    if (!stationName || !address) {
      await transaction.rollback();
      res.status(400).json({ error: 'Station name and address are required.' });
      return;
    }
    if (!fullName || !username || password.length < 4) {
      await transaction.rollback();
      res.status(400).json({ error: 'Manager full name, username, and password (min 4 chars) are required.' });
      return;
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      await transaction.rollback();
      res.status(400).json({ error: 'Username must be 3–32 characters (letters, numbers, dot, underscore, hyphen).' });
      return;
    }

    const existingUser = await UserModel.findOne({ where: { username }, transaction });
    if (existingUser) {
      await transaction.rollback();
      res.status(409).json({ error: `Username "${username}" is already taken.` });
      return;
    }

    let code = rawCode;
    if (!code) {
      const count = await StationModel.count({ transaction });
      let seq = count + 1;
      code = `STN-${String(seq).padStart(2, '0')}`;
      while (await StationModel.findOne({ where: { code }, transaction })) {
        seq += 1;
        code = `STN-${String(seq).padStart(2, '0')}`;
      }
    } else {
      const existingStation = await StationModel.findOne({ where: { code }, transaction });
      if (existingStation) {
        await transaction.rollback();
        res.status(409).json({ error: `Station code "${code}" is already registered.` });
        return;
      }
    }

    const station = await StationModel.create(
      {
        code,
        name: stationName,
        brand,
        address,
        tin,
        active: true,
      },
      { transaction }
    );
    const stationId = station.get('id') as number;

    const managerUser = await UserModel.create(
      {
        username,
        fullName,
        passwordHash: hashPassword(password),
        role: 'MANAGER',
        stationId,
        active: true,
      },
      { transaction }
    );

    let generatedCashier: { username: string; password: string } | null = null;
    if (createStarterCashier) {
      const slug = code.toLowerCase().replace(/[^a-z0-9]/g, '');
      let cshUsername = `csh_${slug}`;
      let suffix = 1;
      while (await UserModel.findOne({ where: { username: cshUsername }, transaction })) {
        suffix += 1;
        cshUsername = `csh_${slug}_${suffix}`;
      }
      await UserModel.create(
        {
          username: cshUsername,
          fullName: `${stationName} Cashier`,
          passwordHash: hashPassword('cashier123'),
          role: 'CASHIER',
          stationId,
          active: true,
        },
        { transaction }
      );
      generatedCashier = { username: cshUsername, password: 'cashier123' };
    }

    await transaction.commit();

    if (seedStarter) {
      await seedStarterInventoryForStation(stationId);
    }

    const authUser = await buildAuthUserInfo(managerUser);
    const token = signToken(authUser);

    res.status(201).json({
      token,
      user: authUser,
      station: station.get({ plain: true }),
      generatedCashier,
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Register station failed:', err);
    res.status(500).json({ error: 'Failed to register gas station.' });
  }
});

// Public Self-Registration: Request Cashier account for an existing station (starts inactive until approved by Admin)
apiRouter.post('/auth/register-staff', async (req, res) => {
  try {
    const stationId = Number(req.body?.stationId);
    const fullName = String(req.body?.fullName || '').trim();
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!stationId || !fullName || !username || password.length < 4) {
      res.status(400).json({ error: 'Gas station, full name, username, and password (min 4 chars) are required.' });
      return;
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      res.status(400).json({ error: 'Username must be 3–32 characters (letters, numbers, dot, underscore, hyphen).' });
      return;
    }

    const station = await StationModel.findByPk(stationId);
    if (!station || !station.get('active')) {
      res.status(404).json({ error: 'Selected gas station is not active or does not exist.' });
      return;
    }

    const existingUser = await UserModel.findOne({ where: { username } });
    if (existingUser) {
      res.status(409).json({ error: `Username "${username}" is already taken.` });
      return;
    }

    const created = await UserModel.create({
      username,
      fullName,
      passwordHash: hashPassword(password),
      role: 'CASHIER',
      stationId,
      active: false,
    });

    res.status(201).json({
      pending: true,
      message: `Cashier request for ${station.get('brand')} · ${station.get('name')} submitted. Ask an Administrator to activate "${username}" in Staff & Roles.`,
      user: {
        id: created.get('id'),
        username: created.get('username'),
        fullName: created.get('fullName'),
        stationName: station.get('name'),
        active: false,
      },
    });
  } catch (err) {
    console.error('Register staff request failed:', err);
    res.status(500).json({ error: 'Failed to submit cashier registration.' });
  }
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.authUser });
});

// POS Catalog (Cashier / Manager only, scoped to user's assigned station)
apiRouter.get('/pos/catalog', requireAuth, requireRole(['CASHIER', 'MANAGER']), async (req: AuthenticatedRequest, res) => {
  try {
    const stationId = req.authUser!.stationId!;
    const tanks = await FuelTankModel.findAll({
      where: { stationId },
      order: [['id', 'ASC']],
    });
    const storeItems = await StoreItemModel.findAll({
      where: { stationId, active: true },
      order: [['category', 'ASC'], ['name', 'ASC']],
    });
    res.json({
      tanks: tanks.map((t) => t.get({ plain: true })),
      storeItems: storeItems.map((s) => s.get({ plain: true })),
    });
  } catch (err) {
    console.error('Catalog load failed:', err);
    res.status(500).json({ error: 'Failed to load POS catalog.' });
  }
});

interface IncomingCartLine {
  itemType: 'FUEL' | 'STORE';
  fuelTankId?: number;
  storeItemId?: number;
  inputMode?: 'LITERS' | 'PESOS';
  amount?: number;
  quantity?: number;
}

// Create Sale (Atomic Sequelize Transaction - Cashier / Manager only, station-scoped)
apiRouter.post('/sales', requireAuth, requireRole(['CASHIER', 'MANAGER']), async (req: AuthenticatedRequest, res) => {
  const transaction = await sequelize.transaction();
  try {
    const stationId = req.authUser!.stationId!;
    const station = await StationModel.findByPk(stationId, { transaction });
    if (!station) {
      await transaction.rollback();
      res.status(404).json({ error: 'Assigned gas station not found.' });
      return;
    }

    const lines = Array.isArray(req.body?.lines) ? (req.body.lines as IncomingCartLine[]) : [];
    const paymentMethod = (req.body?.paymentMethod || 'CASH') as PaymentMethod;
    const pumpLabel = String(req.body?.pumpLabel || 'Island 1 · Pump A').trim() || 'Counter Only';
    const rawTendered = Number(req.body?.amountTendered ?? 0);

    if (lines.length === 0) {
      await transaction.rollback();
      res.status(400).json({ error: 'Order cannot be empty.' });
      return;
    }
    if (!['CASH', 'CARD', 'GCASH'].includes(paymentMethod)) {
      await transaction.rollback();
      res.status(400).json({ error: 'Unsupported payment method.' });
      return;
    }

    const preparedItems: Array<{
      itemType: 'FUEL' | 'STORE';
      fuelTankId: number | null;
      storeItemId: number | null;
      itemName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    let totalAmount = 0;

    for (const line of lines) {
      if (line.itemType === 'FUEL') {
        const tankId = Number(line.fuelTankId);
        const tank = await FuelTankModel.findOne({ where: { id: tankId, stationId }, transaction });
        if (!tank) {
          await transaction.rollback();
          res.status(404).json({ error: 'Selected fuel grade not found for this station.' });
          return;
        }
        const pricePerLiter = Number(tank.get('pricePerLiter'));
        const currentLiters = Number(tank.get('currentLiters'));
        const inputMode = line.inputMode === 'PESOS' ? 'PESOS' : 'LITERS';
        const rawAmount = Number(line.amount ?? 0);

        if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
          await transaction.rollback();
          res.status(400).json({ error: 'Fuel amount must be greater than zero.' });
          return;
        }

        const liters = inputMode === 'PESOS' ? round3(rawAmount / pricePerLiter) : round3(rawAmount);
        const lineTotal = inputMode === 'PESOS' ? round2(rawAmount) : round2(liters * pricePerLiter);

        if (liters > currentLiters) {
          await transaction.rollback();
          res.status(409).json({
            error: `Insufficient ${tank.get('name')} tank inventory (${currentLiters.toFixed(2)} L available).`,
          });
          return;
        }

        await tank.update(
          { currentLiters: round3(currentLiters - liters) },
          { transaction }
        );

        totalAmount = round2(totalAmount + lineTotal);
        preparedItems.push({
          itemType: 'FUEL',
          fuelTankId: tankId,
          storeItemId: null,
          itemName: tank.get('name') as string,
          quantity: liters,
          unit: 'L',
          unitPrice: pricePerLiter,
          lineTotal,
        });
      } else if (line.itemType === 'STORE') {
        const itemId = Number(line.storeItemId);
        const qty = Math.floor(Number(line.quantity ?? 0));
        if (!Number.isFinite(qty) || qty <= 0) {
          await transaction.rollback();
          res.status(400).json({ error: 'Store item quantity must be at least 1.' });
          return;
        }
        const storeItem = await StoreItemModel.findOne({ where: { id: itemId, stationId }, transaction });
        if (!storeItem || !storeItem.get('active')) {
          await transaction.rollback();
          res.status(404).json({ error: 'Convenience store item not found for this station.' });
          return;
        }
        const stockQty = Number(storeItem.get('stockQty'));
        if (qty > stockQty) {
          await transaction.rollback();
          res.status(409).json({
            error: `Insufficient stock for ${storeItem.get('name')} (${stockQty} remaining).`,
          });
          return;
        }
        const unitPrice = Number(storeItem.get('unitPrice'));
        const lineTotal = round2(unitPrice * qty);

        await storeItem.update(
          { stockQty: stockQty - qty },
          { transaction }
        );

        totalAmount = round2(totalAmount + lineTotal);
        preparedItems.push({
          itemType: 'STORE',
          fuelTankId: null,
          storeItemId: itemId,
          itemName: storeItem.get('name') as string,
          quantity: qty,
          unit: 'pc',
          unitPrice,
          lineTotal,
        });
      }
    }

    const amountTendered = paymentMethod === 'CASH' ? round2(rawTendered) : totalAmount;
    if (paymentMethod === 'CASH' && amountTendered < totalAmount) {
      await transaction.rollback();
      res.status(400).json({ error: 'Amount tendered is less than the total due.' });
      return;
    }

    const changeAmount = paymentMethod === 'CASH' ? round2(amountTendered - totalAmount) : 0;
    const vatableSales = round2(totalAmount / 1.12);
    const vatAmount = round2(totalAmount - vatableSales);

    const lastSale = await SaleModel.findOne({ order: [['id', 'DESC']], transaction });
    const nextNum = ((lastSale?.get('id') as number | undefined) ?? 0) + 1;
    const cleanCode = String(station.get('code') || 'STN').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const receiptNo = `OR-${cleanCode}-${formatDateKey(new Date())}-${String(nextNum).padStart(4, '0')}`;

    const sale = await SaleModel.create(
      {
        stationId,
        receiptNo,
        cashierId: req.authUser!.uid,
        cashierName: req.authUser!.fullName,
        pumpLabel,
        paymentMethod,
        subtotal: vatableSales,
        vatAmount,
        totalAmount,
        amountTendered,
        changeAmount,
        status: 'COMPLETED',
        zReadingId: null,
      },
      { transaction }
    );

    const saleId = sale.get('id') as number;
    for (const item of preparedItems) {
      await SaleItemModel.create({ ...item, saleId }, { transaction });
    }

    await transaction.commit();

    const fullSale = await SaleModel.findByPk(saleId, {
      include: [{ model: SaleItemModel, as: 'items' }],
    });
    const stationMap = await getStationMap();
    res.status(201).json({ sale: enrichWithStation(fullSale!.get({ plain: true }), stationMap) });
  } catch (err) {
    await transaction.rollback();
    console.error('Create sale error:', err);
    res.status(500).json({ error: 'Failed to process transaction.' });
  }
});

// List Sales (scoped to assigned station for Cashier/Manager)
apiRouter.get('/sales', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const onlyOpen = req.query.onlyOpen === 'true';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const dateFilter = typeof req.query.date === 'string' ? req.query.date : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    const whereClause: Record<string, unknown> = {};
    if (req.authUser!.role !== 'ADMIN') {
      whereClause.stationId = req.authUser!.stationId;
    } else if (req.query.stationId && req.query.stationId !== 'all') {
      whereClause.stationId = Number(req.query.stationId);
    }

    if (onlyOpen) {
      whereClause.zReadingId = null;
    }
    if (status && ['COMPLETED', 'VOIDED'].includes(status)) {
      whereClause.status = status;
    }
    if (dateFilter) {
      const start = new Date(`${dateFilter}T00:00:00`);
      const end = new Date(`${dateFilter}T23:59:59.999`);
      if (!Number.isNaN(start.getTime())) {
        whereClause.createdAt = { [Op.between]: [start, end] };
      }
    }

    const sales = await SaleModel.findAll({
      where: whereClause,
      include: [{ model: SaleItemModel, as: 'items' }],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: 200,
    });

    const stationMap = await getStationMap();
    const plain = sales.map((s) =>
      enrichWithStation(s.get({ plain: true }) as unknown as Record<string, unknown> & { stationId?: number }, stationMap)
    );
    const filtered = search
      ? plain.filter((s) => {
          const receipt = String(s.receiptNo || '').toLowerCase();
          const cashier = String(s.cashierName || '').toLowerCase();
          const pump = String(s.pumpLabel || '').toLowerCase();
          return receipt.includes(search) || cashier.includes(search) || pump.includes(search);
        })
      : plain;

    res.json({ sales: filtered });
  } catch (err) {
    console.error('Fetch sales error:', err);
    res.status(500).json({ error: 'Failed to load sales log.' });
  }
});

// Void Sale (Manager only, scoped to Manager's station)
apiRouter.post('/sales/:id/void', requireAuth, requireRole(['MANAGER']), async (req: AuthenticatedRequest, res) => {
  const transaction = await sequelize.transaction();
  try {
    const stationId = req.authUser!.stationId!;
    const saleId = Number(req.params.id);
    const sale = await SaleModel.findOne({
      where: { id: saleId, stationId },
      include: [{ model: SaleItemModel, as: 'items' }],
      transaction,
    });

    if (!sale) {
      await transaction.rollback();
      res.status(404).json({ error: 'Transaction not found for your station.' });
      return;
    }
    if (sale.get('status') === 'VOIDED') {
      await transaction.rollback();
      res.status(400).json({ error: 'Transaction is already voided.' });
      return;
    }
    if (sale.get('zReadingId') !== null) {
      await transaction.rollback();
      res.status(409).json({ error: 'Cannot void a transaction already closed in a Z-Reading.' });
      return;
    }

    const plain = sale.get({ plain: true }) as {
      receiptNo: string;
      items?: Array<{ itemType: string; fuelTankId: number | null; storeItemId: number | null; itemName: string; quantity: number }>;
    };
    for (const item of plain.items || []) {
      if (item.itemType === 'FUEL' && item.fuelTankId) {
        const tank = await FuelTankModel.findOne({ where: { id: item.fuelTankId, stationId }, transaction });
        if (tank) {
          await tank.update(
            { currentLiters: round3(Number(tank.get('currentLiters')) + Number(item.quantity)) },
            { transaction }
          );
          await InventoryAdjustmentModel.create(
            {
              stationId,
              itemType: 'FUEL',
              refId: item.fuelTankId,
              itemName: item.itemName,
              deltaQty: Number(item.quantity),
              reason: `Void Reversal · ${plain.receiptNo}`,
              performedBy: req.authUser!.fullName,
            },
            { transaction }
          );
        }
      } else if (item.itemType === 'STORE' && item.storeItemId) {
        const storeItem = await StoreItemModel.findOne({ where: { id: item.storeItemId, stationId }, transaction });
        if (storeItem) {
          await storeItem.update(
            { stockQty: Number(storeItem.get('stockQty')) + Math.round(Number(item.quantity)) },
            { transaction }
          );
          await InventoryAdjustmentModel.create(
            {
              stationId,
              itemType: 'STORE',
              refId: item.storeItemId,
              itemName: item.itemName,
              deltaQty: Number(item.quantity),
              reason: `Void Reversal · ${plain.receiptNo}`,
              performedBy: req.authUser!.fullName,
            },
            { transaction }
          );
        }
      }
    }

    await sale.update({ status: 'VOIDED' }, { transaction });
    await transaction.commit();

    const updated = await SaleModel.findByPk(saleId, {
      include: [{ model: SaleItemModel, as: 'items' }],
    });
    const stationMap = await getStationMap();
    res.json({ sale: enrichWithStation(updated!.get({ plain: true }), stationMap) });
  } catch (err) {
    await transaction.rollback();
    console.error('Void sale failed:', err);
    res.status(500).json({ error: 'Failed to void transaction.' });
  }
});

async function computeOpenShiftSummary(stationId: number) {
  const openSales = await SaleModel.findAll({
    where: { stationId, zReadingId: null },
    include: [{ model: SaleItemModel, as: 'items' }],
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
  });

  const plainSales = openSales.map((s) => s.get({ plain: true }) as unknown as {
    id: number;
    receiptNo: string;
    paymentMethod: PaymentMethod;
    subtotal: number;
    vatAmount: number;
    totalAmount: number;
    status: 'COMPLETED' | 'VOIDED';
    createdAt: string;
    items?: Array<{
      itemType: 'FUEL' | 'STORE';
      itemName: string;
      quantity: number;
      lineTotal: number;
    }>;
  });

  const completed = plainSales.filter((s) => s.status === 'COMPLETED');
  const voided = plainSales.filter((s) => s.status === 'VOIDED');

  let fuelRevenue = 0;
  let storeRevenue = 0;
  let totalFuelLiters = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  let gcashTotal = 0;
  const fuelBreakdown: Record<string, { liters: number; revenue: number }> = {};

  for (const sale of completed) {
    if (sale.paymentMethod === 'CASH') cashTotal += Number(sale.totalAmount);
    if (sale.paymentMethod === 'CARD') cardTotal += Number(sale.totalAmount);
    if (sale.paymentMethod === 'GCASH') gcashTotal += Number(sale.totalAmount);

    for (const item of sale.items || []) {
      if (item.itemType === 'FUEL') {
        fuelRevenue += Number(item.lineTotal);
        totalFuelLiters += Number(item.quantity);
        if (!fuelBreakdown[item.itemName]) {
          fuelBreakdown[item.itemName] = { liters: 0, revenue: 0 };
        }
        fuelBreakdown[item.itemName].liters = round3(fuelBreakdown[item.itemName].liters + Number(item.quantity));
        fuelBreakdown[item.itemName].revenue = round2(fuelBreakdown[item.itemName].revenue + Number(item.lineTotal));
      } else {
        storeRevenue += Number(item.lineTotal);
      }
    }
  }

  const totalRevenue = round2(fuelRevenue + storeRevenue);
  const totalVatableSales = round2(totalRevenue / 1.12);
  const totalVat = round2(totalRevenue - totalVatableSales);

  return {
    openSaleIds: plainSales.map((s) => s.id),
    transactionCount: completed.length,
    voidedCount: voided.length,
    fuelRevenue: round2(fuelRevenue),
    storeRevenue: round2(storeRevenue),
    totalRevenue,
    totalVatableSales,
    totalVat,
    cashTotal: round2(cashTotal),
    cardTotal: round2(cardTotal),
    gcashTotal: round2(gcashTotal),
    totalFuelLiters: round3(totalFuelLiters),
    beginningOrNo: plainSales.length > 0 ? plainSales[0].receiptNo : 'N/A',
    endingOrNo: plainSales.length > 0 ? plainSales[plainSales.length - 1].receiptNo : 'N/A',
    periodStart: plainSales.length > 0 ? plainSales[0].createdAt : new Date().toISOString(),
    periodEnd: new Date().toISOString(),
    fuelBreakdown: Object.entries(fuelBreakdown).map(([name, stats]) => ({ name, ...stats })),
  };
}

// Z-Reading Preview (Manager only, scoped to Manager's station)
apiRouter.get('/z-reading/preview', requireAuth, requireRole(['MANAGER']), async (req: AuthenticatedRequest, res) => {
  try {
    const summary = await computeOpenShiftSummary(req.authUser!.stationId!);
    res.json({ preview: summary });
  } catch (err) {
    console.error('Z-reading preview failed:', err);
    res.status(500).json({ error: 'Failed to calculate open shift summary.' });
  }
});

// Close Z-Reading (Manager only, scoped to Manager's station)
apiRouter.post('/z-reading/close', requireAuth, requireRole(['MANAGER']), async (req: AuthenticatedRequest, res) => {
  const transaction = await sequelize.transaction();
  try {
    const stationId = req.authUser!.stationId!;
    const station = await StationModel.findByPk(stationId, { transaction });
    const summary = await computeOpenShiftSummary(stationId);
    if (summary.openSaleIds.length === 0) {
      await transaction.rollback();
      res.status(400).json({ error: 'There are no open transactions to close.' });
      return;
    }

    const actualCashCount = round2(Number(req.body?.actualCashCount ?? summary.cashTotal));
    const notes = String(req.body?.notes || '').trim();
    const cashVariance = round2(actualCashCount - summary.cashTotal);

    const lastZ = await ZReadingModel.findOne({ order: [['id', 'DESC']], transaction });
    const nextSeq = ((lastZ?.get('id') as number | undefined) ?? 0) + 1;
    const cleanCode = String(station?.get('code') || 'STN').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const readingNumber = `Z-${cleanCode}-${formatDateKey(new Date())}-${String(nextSeq).padStart(3, '0')}`;

    const zReading = await ZReadingModel.create(
      {
        stationId,
        readingNumber,
        closedById: req.authUser!.uid,
        closedByName: req.authUser!.fullName,
        periodStart: new Date(summary.periodStart),
        periodEnd: new Date(),
        transactionCount: summary.transactionCount,
        voidedCount: summary.voidedCount,
        fuelRevenue: summary.fuelRevenue,
        storeRevenue: summary.storeRevenue,
        totalRevenue: summary.totalRevenue,
        totalVatableSales: summary.totalVatableSales,
        totalVat: summary.totalVat,
        cashTotal: summary.cashTotal,
        cardTotal: summary.cardTotal,
        gcashTotal: summary.gcashTotal,
        totalFuelLiters: summary.totalFuelLiters,
        beginningOrNo: summary.beginningOrNo,
        endingOrNo: summary.endingOrNo,
        actualCashCount,
        cashVariance,
        notes,
      },
      { transaction }
    );

    const zId = zReading.get('id') as number;
    await SaleModel.update(
      { zReadingId: zId },
      { where: { id: { [Op.in]: summary.openSaleIds }, stationId }, transaction }
    );

    await transaction.commit();
    const stationMap = await getStationMap();
    res.status(201).json({ zReading: enrichWithStation(zReading.get({ plain: true }), stationMap) });
  } catch (err) {
    await transaction.rollback();
    console.error('Close Z-reading failed:', err);
    res.status(500).json({ error: 'Failed to finalize Z-reading.' });
  }
});

// List Historical Z-Readings (Manager only, scoped to Manager's station)
apiRouter.get('/z-readings', requireAuth, requireRole(['MANAGER']), async (req: AuthenticatedRequest, res) => {
  try {
    const stationId = req.authUser!.stationId!;
    const list = await ZReadingModel.findAll({
      where: { stationId },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: 60,
    });
    const stationMap = await getStationMap();
    res.json({ zReadings: list.map((z) => enrichWithStation(z.get({ plain: true }), stationMap)) });
  } catch (err) {
    console.error('List Z-readings failed:', err);
    res.status(500).json({ error: 'Failed to load Z-reading history.' });
  }
});

// Dashboard Analytics (Admin can view all stations or filter one; Manager sees their station only)
apiRouter.get('/dashboard/analytics', requireAuth, requireRole(['ADMIN', 'MANAGER']), async (req: AuthenticatedRequest, res) => {
  try {
    const isAdmin = req.authUser!.role === 'ADMIN';
    const rawStationParam = typeof req.query.stationId === 'string' ? req.query.stationId : 'all';
    const selectedStationId: number | null = isAdmin
      ? rawStationParam !== 'all' && Number.isFinite(Number(rawStationParam))
        ? Number(rawStationParam)
        : null
      : req.authUser!.stationId!;

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const saleWhere: Record<string, unknown> = {
      status: 'COMPLETED',
      createdAt: { [Op.gte]: sevenDaysAgo },
    };
    if (selectedStationId !== null) {
      saleWhere.stationId = selectedStationId;
    }

    const recentSales = await SaleModel.findAll({
      where: saleWhere,
      include: [{ model: SaleItemModel, as: 'items' }],
      order: [['createdAt', 'ASC']],
    });

    const todayKey = formatDayIso(now);
    const dayMap = new Map<
      string,
      { date: string; label: string; fuelRevenue: number; storeRevenue: number; totalRevenue: number; transactions: number; liters: number }
    >();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = formatDayIso(d);
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      dayMap.set(key, {
        date: key,
        label,
        fuelRevenue: 0,
        storeRevenue: 0,
        totalRevenue: 0,
        transactions: 0,
        liters: 0,
      });
    }

    const itemStats = new Map<
      string,
      { name: string; itemType: 'FUEL' | 'STORE'; unit: string; quantity: number; revenue: number }
    >();

    let openShiftTotal = 0;
    let openShiftCount = 0;
    let cashRevenue = 0;
    let cardRevenue = 0;
    let gcashRevenue = 0;

    for (const s of recentSales) {
      const sale = s.get({ plain: true }) as unknown as {
        stationId: number;
        totalAmount: number;
        paymentMethod: PaymentMethod;
        zReadingId: number | null;
        createdAt: Date | string;
        items?: Array<{ itemType: 'FUEL' | 'STORE'; itemName: string; unit: string; quantity: number; lineTotal: number }>;
      };

      if (sale.paymentMethod === 'CASH') cashRevenue = round2(cashRevenue + Number(sale.totalAmount));
      if (sale.paymentMethod === 'CARD') cardRevenue = round2(cardRevenue + Number(sale.totalAmount));
      if (sale.paymentMethod === 'GCASH') gcashRevenue = round2(gcashRevenue + Number(sale.totalAmount));

      if (sale.zReadingId === null) {
        openShiftTotal = round2(openShiftTotal + Number(sale.totalAmount));
        openShiftCount += 1;
      }

      const key = formatDayIso(new Date(sale.createdAt));
      const dayBucket = dayMap.get(key);

      if (dayBucket) {
        dayBucket.transactions += 1;
        dayBucket.totalRevenue = round2(dayBucket.totalRevenue + Number(sale.totalAmount));
      }

      for (const item of sale.items || []) {
        if (dayBucket) {
          if (item.itemType === 'FUEL') {
            dayBucket.fuelRevenue = round2(dayBucket.fuelRevenue + Number(item.lineTotal));
            dayBucket.liters = round3(dayBucket.liters + Number(item.quantity));
          } else {
            dayBucket.storeRevenue = round2(dayBucket.storeRevenue + Number(item.lineTotal));
          }
        }

        const statKey = `${item.itemType}:${item.itemName}`;
        const existing = itemStats.get(statKey) || {
          name: item.itemName,
          itemType: item.itemType,
          unit: item.unit,
          quantity: 0,
          revenue: 0,
        };
        existing.quantity = item.itemType === 'FUEL' ? round3(existing.quantity + Number(item.quantity)) : existing.quantity + Number(item.quantity);
        existing.revenue = round2(existing.revenue + Number(item.lineTotal));
        itemStats.set(statKey, existing);
      }
    }

    const stationMap = await getStationMap();
    const tankWhere = selectedStationId !== null ? { stationId: selectedStationId } : {};
    const storeWhere = selectedStationId !== null ? { stationId: selectedStationId, active: true } : { active: true };

    const tanks = await FuelTankModel.findAll({ where: tankWhere, order: [['stationId', 'ASC'], ['id', 'ASC']] });
    const storeItems = await StoreItemModel.findAll({ where: storeWhere });

    const lowStockAlerts: Array<{
      stationId: number;
      stationName: string;
      itemType: 'FUEL' | 'STORE';
      name: string;
      remaining: string;
      threshold: string;
    }> = [];

    for (const t of tanks) {
      const stId = Number(t.get('stationId'));
      const cur = Number(t.get('currentLiters'));
      const thresh = Number(t.get('reorderThresholdLiters'));
      if (cur <= thresh) {
        lowStockAlerts.push({
          stationId: stId,
          stationName: stationMap.get(stId)?.name || `Station ${stId}`,
          itemType: 'FUEL',
          name: t.get('name') as string,
          remaining: cur <= 0 ? '0.0 L (Out of Gas)' : `${cur.toFixed(1)} L`,
          threshold: `${thresh.toLocaleString()} L`,
        });
      }
    }
    for (const item of storeItems) {
      const stId = Number(item.get('stationId'));
      const qty = Number(item.get('stockQty'));
      const reorder = Number(item.get('reorderLevel'));
      if (qty <= reorder) {
        lowStockAlerts.push({
          stationId: stId,
          stationName: stationMap.get(stId)?.name || `Station ${stId}`,
          itemType: 'STORE',
          name: item.get('name') as string,
          remaining: `${qty} pc`,
          threshold: `${reorder} pc`,
        });
      }
    }

    const dailySeries = Array.from(dayMap.values());
    const todayBucket = dayMap.get(todayKey) || {
      totalRevenue: 0,
      fuelRevenue: 0,
      storeRevenue: 0,
      transactions: 0,
      liters: 0,
    };

    const weeklyRevenue = round2(dailySeries.reduce((acc, d) => acc + d.totalRevenue, 0));
    const weeklyFuelRevenue = round2(dailySeries.reduce((acc, d) => acc + d.fuelRevenue, 0));
    const weeklyStoreRevenue = round2(dailySeries.reduce((acc, d) => acc + d.storeRevenue, 0));
    const weeklyLiters = round3(dailySeries.reduce((acc, d) => acc + d.liters, 0));

    const allTopItems = Array.from(itemStats.values()).sort((a, b) => b.revenue - a.revenue);
    const topFuel = allTopItems.filter((i) => i.itemType === 'FUEL');
    const topStore = allTopItems.filter((i) => i.itemType === 'STORE').slice(0, 6);

    // Station-by-station summary for Admin
    let stationBreakdown: Array<{
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
    }> = [];

    if (isAdmin) {
      const allSales7d = await SaleModel.findAll({
        where: { status: 'COMPLETED', createdAt: { [Op.gte]: sevenDaysAgo } },
        include: [{ model: SaleItemModel, as: 'items' }],
      });
      const allTanks = await FuelTankModel.findAll();
      const allStore = await StoreItemModel.findAll({ where: { active: true } });

      stationBreakdown = Array.from(stationMap.values()).map((st) => {
        const stSales = allSales7d
          .map((s) => s.get({ plain: true }) as unknown as {
            stationId: number;
            totalAmount: number;
            createdAt: Date | string;
            items?: Array<{ itemType: 'FUEL' | 'STORE'; quantity: number }>;
          })
          .filter((s) => s.stationId === st.id);

        let stToday = 0;
        let stWeekly = 0;
        let stLiters = 0;
        for (const s of stSales) {
          stWeekly = round2(stWeekly + Number(s.totalAmount));
          if (formatDayIso(new Date(s.createdAt)) === todayKey) {
            stToday = round2(stToday + Number(s.totalAmount));
          }
          for (const it of s.items || []) {
            if (it.itemType === 'FUEL') {
              stLiters = round3(stLiters + Number(it.quantity));
            }
          }
        }

        const stTanks = allTanks.filter((t) => Number(t.get('stationId')) === st.id);
        const outOfGasCount = stTanks.filter((t) => Number(t.get('currentLiters')) <= 0).length;
        const lowTanks = stTanks.filter(
          (t) => Number(t.get('currentLiters')) > 0 && Number(t.get('currentLiters')) <= Number(t.get('reorderThresholdLiters'))
        ).length;
        const lowStore = allStore.filter(
          (i) => Number(i.get('stationId')) === st.id && Number(i.get('stockQty')) <= Number(i.get('reorderLevel'))
        ).length;

        return {
          stationId: st.id,
          code: st.code,
          name: st.name,
          brand: st.brand,
          active: st.active,
          todayRevenue: stToday,
          weeklyRevenue: stWeekly,
          weeklyLiters: stLiters,
          transactions: stSales.length,
          outOfGasCount,
          lowStockCount: lowTanks + lowStore,
        };
      });
    }

    res.json({
      selectedStationId,
      stations: isAdmin ? Array.from(stationMap.values()) : [],
      stationBreakdown,
      kpis: {
        todayRevenue: todayBucket.totalRevenue,
        todayTransactions: todayBucket.transactions,
        todayLiters: todayBucket.liters,
        openShiftTotal,
        openShiftCount,
        weeklyRevenue,
        weeklyFuelRevenue,
        weeklyStoreRevenue,
        weeklyLiters,
      },
      paymentBreakdown: {
        cash: cashRevenue,
        card: cardRevenue,
        gcash: gcashRevenue,
      },
      lowStockAlerts,
      dailySeries,
      topFuel,
      topStore,
    });
  } catch (err) {
    console.error('Analytics load failed:', err);
    res.status(500).json({ error: 'Failed to load dashboard analytics.' });
  }
});

// Inventory Endpoints (Manager only, strictly scoped to Manager's station)
apiRouter.get('/inventory', requireAuth, requireRole(['MANAGER']), async (req: AuthenticatedRequest, res) => {
  try {
    const stationId = req.authUser!.stationId!;
    const tanks = await FuelTankModel.findAll({ where: { stationId }, order: [['id', 'ASC']] });
    const storeItems = await StoreItemModel.findAll({
      where: { stationId },
      order: [['category', 'ASC'], ['name', 'ASC']],
    });
    const adjustments = await InventoryAdjustmentModel.findAll({
      where: { stationId },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: 40,
    });
    res.json({
      tanks: tanks.map((t) => t.get({ plain: true })),
      storeItems: storeItems.map((s) => s.get({ plain: true })),
      adjustments: adjustments.map((a) => a.get({ plain: true })),
    });
  } catch (err) {
    console.error('Inventory load failed:', err);
    res.status(500).json({ error: 'Failed to load inventory.' });
  }
});

apiRouter.post('/inventory/fuel', requireAuth, requireRole(['MANAGER']), async (req: AuthenticatedRequest, res) => {
  try {
    const stationId = req.authUser!.stationId!;
    const code = String(req.body?.code || '').trim().toUpperCase();
    const name = String(req.body?.name || '').trim();
    const pricePerLiter = round2(Number(req.body?.pricePerLiter ?? 0));
    const capacityLiters = round3(Number(req.body?.capacityLiters ?? 20000));
    const currentLiters = Math.min(capacityLiters, Math.max(0, round3(Number(req.body?.currentLiters ?? 0))));
    const reorderThresholdLiters = Math.max(100, round3(Number(req.body?.reorderThresholdLiters ?? 3000)));

    if (!code || !name || pricePerLiter <= 0 || capacityLiters <= 0) {
      res.status(400).json({ error: 'Fuel code, name, valid price per liter, and capacity are required.' });
      return;
    }

    const existing = await FuelTankModel.findOne({ where: { stationId, code } });
    if (existing) {
      res.status(409).json({ error: `Fuel grade code "${code}" already exists for this station.` });
      return;
    }

    const tank = await FuelTankModel.create({
      stationId,
      code,
      name,
      pricePerLiter,
      currentLiters,
      capacityLiters,
      reorderThresholdLiters,
    });

    if (currentLiters > 0) {
      await InventoryAdjustmentModel.create({
        stationId,
        itemType: 'FUEL',
        refId: tank.get('id') as number,
        itemName: name,
        deltaQty: currentLiters,
        reason: 'Initial Tank Commission',
        performedBy: req.authUser!.fullName,
      });
    }

    res.status(201).json({ tank: tank.get({ plain: true }) });
  } catch (err) {
    console.error('Create fuel tank failed:', err);
    res.status(500).json({ error: 'Failed to add fuel tank.' });
  }
});

apiRouter.post('/inventory/fuel/:id/adjust', requireAuth, requireRole(['MANAGER']), async (req: AuthenticatedRequest, res) => {
  const transaction = await sequelize.transaction();
  try {
    const stationId = req.authUser!.stationId!;
    const tank = await FuelTankModel.findOne({ where: { id: Number(req.params.id), stationId }, transaction });
    if (!tank) {
      await transaction.rollback();
      res.status(404).json({ error: 'Fuel tank not found for this station.' });
      return;
    }

    const currentLiters = Number(tank.get('currentLiters'));
    const capacity = Number(tank.get('capacityLiters'));
    const rawTarget = req.body?.targetLiters;
    const rawDelta = req.body?.deltaLiters;

    let deltaLiters = 0;
    if (rawTarget !== undefined && Number.isFinite(Number(rawTarget))) {
      deltaLiters = round3(Number(rawTarget) - currentLiters);
    } else if (rawDelta !== undefined && Number.isFinite(Number(rawDelta))) {
      deltaLiters = round3(Number(rawDelta));
    }

    const newPrice = req.body?.pricePerLiter !== undefined ? Number(req.body.pricePerLiter) : undefined;
    const reason = String(req.body?.reason || '').trim() || 'Tank Calibration';

    const updates: Record<string, unknown> = {};

    if (deltaLiters !== 0) {
      const nextLiters = rawTarget !== undefined && Number.isFinite(Number(rawTarget))
        ? round3(Number(rawTarget))
        : round3(currentLiters + deltaLiters);

      if (nextLiters < 0) {
        await transaction.rollback();
        res.status(400).json({
          error: `Resulting volume (${nextLiters.toFixed(2)} L) cannot be less than 0 L.`,
        });
        return;
      }
      if (nextLiters > capacity) {
        await transaction.rollback();
        res.status(400).json({
          error: `Resulting volume (${nextLiters.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L) exceeds tank capacity of ${capacity.toLocaleString()} L. Maximum you can add is ${(capacity - currentLiters).toFixed(2)} L.`,
        });
        return;
      }
      updates.currentLiters = nextLiters;

      await InventoryAdjustmentModel.create(
        {
          stationId,
          itemType: 'FUEL',
          refId: tank.get('id') as number,
          itemName: tank.get('name') as string,
          deltaQty: deltaLiters,
          reason,
          performedBy: req.authUser!.fullName,
        },
        { transaction }
      );
    }

    if (newPrice !== undefined && Number.isFinite(newPrice) && newPrice > 0) {
      updates.pricePerLiter = round2(newPrice);
    }

    if (Object.keys(updates).length > 0) {
      await tank.update(updates, { transaction });
    }

    await transaction.commit();
    res.json({ tank: tank.get({ plain: true }) });
  } catch (err) {
    await transaction.rollback();
    console.error('Fuel adjustment failed:', err);
    res.status(500).json({ error: 'Failed to update fuel tank.' });
  }
});

apiRouter.post('/inventory/store', requireAuth, requireRole(['MANAGER']), async (req: AuthenticatedRequest, res) => {
  try {
    const stationId = req.authUser!.stationId!;
    const sku = String(req.body?.sku || '').trim().toUpperCase();
    const name = String(req.body?.name || '').trim();
    const category = String(req.body?.category || 'General').trim();
    const unitPrice = round2(Number(req.body?.unitPrice ?? 0));
    const stockQty = Math.max(0, Math.floor(Number(req.body?.stockQty ?? 0)));
    const reorderLevel = Math.max(1, Math.floor(Number(req.body?.reorderLevel ?? 10)));

    if (!sku || !name || unitPrice <= 0) {
      res.status(400).json({ error: 'SKU, product name, and valid unit price are required.' });
      return;
    }

    const existing = await StoreItemModel.findOne({ where: { stationId, sku } });
    if (existing) {
      res.status(409).json({ error: `SKU "${sku}" already exists for this station.` });
      return;
    }

    const item = await StoreItemModel.create({
      stationId,
      sku,
      name,
      category,
      unitPrice,
      stockQty,
      reorderLevel,
      active: true,
    });

    if (stockQty > 0) {
      await InventoryAdjustmentModel.create({
        stationId,
        itemType: 'STORE',
        refId: item.get('id') as number,
        itemName: name,
        deltaQty: stockQty,
        reason: 'Initial Stock Entry',
        performedBy: req.authUser!.fullName,
      });
    }

    res.status(201).json({ item: item.get({ plain: true }) });
  } catch (err) {
    console.error('Create store item failed:', err);
    res.status(500).json({ error: 'Failed to create store item.' });
  }
});

apiRouter.patch('/inventory/store/:id', requireAuth, requireRole(['MANAGER']), async (req: AuthenticatedRequest, res) => {
  const transaction = await sequelize.transaction();
  try {
    const stationId = req.authUser!.stationId!;
    const item = await StoreItemModel.findOne({ where: { id: Number(req.params.id), stationId }, transaction });
    if (!item) {
      await transaction.rollback();
      res.status(404).json({ error: 'Store item not found for this station.' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (req.body?.unitPrice !== undefined) {
      const price = round2(Number(req.body.unitPrice));
      if (price <= 0) {
        await transaction.rollback();
        res.status(400).json({ error: 'Unit price must be greater than zero.' });
        return;
      }
      updates.unitPrice = price;
    }
    if (req.body?.active !== undefined) {
      updates.active = Boolean(req.body.active);
    }

    const deltaQty = req.body?.deltaQty !== undefined ? Math.floor(Number(req.body.deltaQty)) : 0;
    if (deltaQty !== 0) {
      const nextStock = Number(item.get('stockQty')) + deltaQty;
      if (nextStock < 0) {
        await transaction.rollback();
        res.status(400).json({ error: 'Stock cannot go below zero.' });
        return;
      }
      updates.stockQty = nextStock;
      await InventoryAdjustmentModel.create(
        {
          stationId,
          itemType: 'STORE',
          refId: item.get('id') as number,
          itemName: item.get('name') as string,
          deltaQty,
          reason: String(req.body?.reason || '').trim() || 'Stock Adjustment',
          performedBy: req.authUser!.fullName,
        },
        { transaction }
      );
    }

    await item.update(updates, { transaction });
    await transaction.commit();
    res.json({ item: item.get({ plain: true }) });
  } catch (err) {
    await transaction.rollback();
    console.error('Update store item failed:', err);
    res.status(500).json({ error: 'Failed to update store item.' });
  }
});

// Stations Management (Admin only)
apiRouter.get('/stations', requireAuth, requireRole(['ADMIN']), async (_req, res) => {
  try {
    const stations = await StationModel.findAll({ order: [['id', 'ASC']] });
    const tanks = await FuelTankModel.findAll();
    const users = await UserModel.findAll({ where: { active: true } });
    const sales = await SaleModel.findAll({ where: { status: 'COMPLETED' } });

    const list = stations.map((s) => {
      const st = s.get({ plain: true }) as unknown as {
        id: number;
        code: string;
        name: string;
        brand: string;
        address: string;
        tin: string;
        active: boolean;
        createdAt: string;
      };
      const stTanks = tanks.filter((t) => Number(t.get('stationId')) === st.id);
      const stUsers = users.filter((u) => Number(u.get('stationId')) === st.id);
      const stSales = sales.filter((sl) => Number(sl.get('stationId')) === st.id);
      const totalRevenue = round2(stSales.reduce((acc, sl) => acc + Number(sl.get('totalAmount')), 0));

      return {
        ...st,
        tankCount: stTanks.length,
        staffCount: stUsers.length,
        totalRevenue,
        transactionCount: stSales.length,
      };
    });

    res.json({ stations: list });
  } catch (err) {
    console.error('List stations failed:', err);
    res.status(500).json({ error: 'Failed to load gas stations.' });
  }
});

apiRouter.post('/stations', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const name = String(req.body?.name || '').trim();
    const brand = String(req.body?.brand || 'PetroDesk').trim() || 'PetroDesk';
    const address = String(req.body?.address || '').trim();
    const tin = String(req.body?.tin || '009-482-110-000').trim() || '009-482-110-000';
    const seedStarter = req.body?.seedStarterInventory !== false;
    const createDefaultStaff = Boolean(req.body?.createDefaultStaff);

    if (!code || !name || !address) {
      res.status(400).json({ error: 'Station code, branch name, and address are required.' });
      return;
    }

    const exists = await StationModel.findOne({ where: { code } });
    if (exists) {
      res.status(409).json({ error: `Station code "${code}" already exists.` });
      return;
    }

    const station = await StationModel.create({
      code,
      name,
      brand,
      address,
      tin,
      active: true,
    });
    const stationId = station.get('id') as number;

    if (seedStarter) {
      await seedStarterInventoryForStation(stationId);
    }

    const generatedAccounts: Array<{ role: UserRole; username: string; password: string }> = [];
    if (createDefaultStaff) {
      const slug = code.toLowerCase().replace(/[^a-z0-9]/g, '');
      const mgrUser = `mgr_${slug}`;
      const cshUser = `csh_${slug}`;

      if (!(await UserModel.findOne({ where: { username: mgrUser } }))) {
        await UserModel.create({
          username: mgrUser,
          fullName: `${name} Manager`,
          passwordHash: hashPassword('manager123'),
          role: 'MANAGER',
          stationId,
          active: true,
        });
        generatedAccounts.push({ role: 'MANAGER', username: mgrUser, password: 'manager123' });
      }
      if (!(await UserModel.findOne({ where: { username: cshUser } }))) {
        await UserModel.create({
          username: cshUser,
          fullName: `${name} Cashier`,
          passwordHash: hashPassword('cashier123'),
          role: 'CASHIER',
          stationId,
          active: true,
        });
        generatedAccounts.push({ role: 'CASHIER', username: cshUser, password: 'cashier123' });
      }
    }

    res.status(201).json({
      station: station.get({ plain: true }),
      generatedAccounts,
    });
  } catch (err) {
    console.error('Create station failed:', err);
    res.status(500).json({ error: 'Failed to create gas station.' });
  }
});

apiRouter.patch('/stations/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const station = await StationModel.findByPk(Number(req.params.id));
    if (!station) {
      res.status(404).json({ error: 'Gas station not found.' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (req.body?.name !== undefined) updates.name = String(req.body.name).trim();
    if (req.body?.brand !== undefined) updates.brand = String(req.body.brand).trim();
    if (req.body?.address !== undefined) updates.address = String(req.body.address).trim();
    if (req.body?.tin !== undefined) updates.tin = String(req.body.tin).trim();
    if (req.body?.active !== undefined) updates.active = Boolean(req.body.active);

    await station.update(updates);
    res.json({ station: station.get({ plain: true }) });
  } catch (err) {
    console.error('Update station failed:', err);
    res.status(500).json({ error: 'Failed to update gas station.' });
  }
});

// Staff & Roles (Admin only)
apiRouter.get('/users', requireAuth, requireRole(['ADMIN']), async (_req, res) => {
  try {
    const users = await UserModel.findAll({
      attributes: ['id', 'username', 'fullName', 'role', 'stationId', 'active', 'createdAt'],
      order: [['id', 'ASC']],
    });
    const stationMap = await getStationMap();
    res.json({
      users: users.map((u) => {
        const plain = u.get({ plain: true }) as unknown as {
          id: number;
          username: string;
          fullName: string;
          role: UserRole;
          stationId: number | null;
          active: boolean;
          createdAt: string;
        };
        const st = plain.stationId ? stationMap.get(plain.stationId) : undefined;
        return {
          ...plain,
          stationName: plain.role === 'ADMIN' ? 'All Stations (Network)' : st?.name || 'Unassigned',
          stationCode: st?.code || null,
        };
      }),
    });
  } catch (err) {
    console.error('List users failed:', err);
    res.status(500).json({ error: 'Failed to load staff accounts.' });
  }
});

apiRouter.post('/users', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const fullName = String(req.body?.fullName || '').trim();
    const password = String(req.body?.password || '');
    const role = (req.body?.role || 'CASHIER') as UserRole;
    const rawStationId = req.body?.stationId;
    const stationId = role === 'ADMIN' ? null : Number(rawStationId);

    if (!username || !fullName || password.length < 4) {
      res.status(400).json({ error: 'Username, full name, and password (min 4 chars) are required.' });
      return;
    }
    if (!['ADMIN', 'MANAGER', 'CASHIER'].includes(role)) {
      res.status(400).json({ error: 'Invalid role.' });
      return;
    }
    if (role !== 'ADMIN' && (!stationId || !(await StationModel.findByPk(stationId)))) {
      res.status(400).json({ error: 'Managers and Cashiers must be assigned to a valid gas station.' });
      return;
    }

    const exists = await UserModel.findOne({ where: { username } });
    if (exists) {
      res.status(409).json({ error: `Username "${username}" is already taken.` });
      return;
    }

    const created = await UserModel.create({
      username,
      fullName,
      passwordHash: hashPassword(password),
      role,
      stationId,
      active: true,
    });
    res.status(201).json({
      user: {
        id: created.get('id'),
        username: created.get('username'),
        fullName: created.get('fullName'),
        role: created.get('role'),
        stationId: created.get('stationId'),
        active: created.get('active'),
      },
    });
  } catch (err) {
    console.error('Create user failed:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

apiRouter.patch('/users/:id', requireAuth, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const targetId = Number(req.params.id);
    const user = await UserModel.findByPk(targetId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (targetId === req.authUser!.uid && req.body?.active === false) {
      res.status(400).json({ error: 'You cannot deactivate your own active session.' });
      return;
    }

    const updates: Record<string, unknown> = {};
    const nextRole = req.body?.role && ['ADMIN', 'MANAGER', 'CASHIER'].includes(req.body.role)
      ? (req.body.role as UserRole)
      : (user.get('role') as UserRole);

    if (req.body?.fullName !== undefined) {
      updates.fullName = String(req.body.fullName).trim();
    }
    if (req.body?.role !== undefined && ['ADMIN', 'MANAGER', 'CASHIER'].includes(req.body.role)) {
      updates.role = req.body.role;
      if (req.body.role === 'ADMIN') {
        updates.stationId = null;
      }
    }
    if (req.body?.stationId !== undefined && nextRole !== 'ADMIN') {
      const stId = Number(req.body.stationId);
      if (!(await StationModel.findByPk(stId))) {
        res.status(400).json({ error: 'Selected gas station not found.' });
        return;
      }
      updates.stationId = stId;
    }
    if (req.body?.active !== undefined) {
      updates.active = Boolean(req.body.active);
    }
    if (req.body?.password && String(req.body.password).length >= 4) {
      updates.passwordHash = hashPassword(String(req.body.password));
    }

    await user.update(updates);
    res.json({
      user: {
        id: user.get('id'),
        username: user.get('username'),
        fullName: user.get('fullName'),
        role: user.get('role'),
        stationId: user.get('stationId'),
        active: user.get('active'),
      },
    });
  } catch (err) {
    console.error('Update user failed:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});
