import sqlite3 from 'sqlite3';

export const sqliteDialectModule = {
  OPEN_READONLY: sqlite3.OPEN_READONLY,
  OPEN_READWRITE: sqlite3.OPEN_READWRITE,
  OPEN_CREATE: sqlite3.OPEN_CREATE,
  Database: sqlite3.Database,
};
