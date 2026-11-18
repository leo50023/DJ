import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { StationModel, UserModel } from './db.ts';
import type { UserAttrs, UserRole } from './db.ts';
import type { Model } from 'sequelize';

const TOKEN_SECRET = process.env.SESSION_SECRET || 'petrodesk-local-pos-signing-key-2026';

export interface AuthUserInfo {
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

export interface AuthPayload extends AuthUserInfo {
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthPayload;
}

export async function buildAuthUserInfo(user: Model<UserAttrs>): Promise<AuthUserInfo> {
  const stationId = (user.get('stationId') as number | null) ?? null;
  let stationCode: string | null = null;
  let stationName: string | null = null;
  let stationBrand: string | null = null;
  let stationAddress: string | null = null;
  let stationTin: string | null = null;

  if (stationId !== null) {
    const station = await StationModel.findByPk(stationId);
    if (station) {
      stationCode = station.get('code') as string;
      stationName = station.get('name') as string;
      stationBrand = station.get('brand') as string;
      stationAddress = station.get('address') as string;
      stationTin = station.get('tin') as string;
    }
  }

  return {
    uid: user.get('id') as number,
    username: user.get('username') as string,
    fullName: user.get('fullName') as string,
    role: user.get('role') as UserRole,
    stationId,
    stationCode,
    stationName,
    stationBrand,
    stationAddress,
    stationTin,
  };
}

export function signToken(payload: AuthUserInfo): string {
  const fullPayload: AuthPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 16, // 16-hour shift token
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyToken(token: string): AuthPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AuthPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = authHeader.slice(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Session expired or invalid token' });
    return;
  }
  const user = await UserModel.findByPk(decoded.uid);
  if (!user || !user.get('active')) {
    res.status(401).json({ error: 'Account is inactive or no longer exists' });
    return;
  }
  const info = await buildAuthUserInfo(user);
  if (info.role !== 'ADMIN' && info.stationId === null) {
    res.status(403).json({ error: 'User account is not assigned to a gas station.' });
    return;
  }
  if (info.stationId !== null) {
    const station = await StationModel.findByPk(info.stationId);
    if (!station || !station.get('active')) {
      res.status(403).json({ error: 'Assigned gas station is currently inactive.' });
      return;
    }
  }
  req.authUser = {
    ...info,
    exp: decoded.exp,
  };
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({ error: `Access denied. Requires role: ${allowedRoles.join(' or ')}` });
      return;
    }
    next();
  };
}
