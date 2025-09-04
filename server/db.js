import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';

sqlite3.verbose();

const DB_PATH = '/workspace/server/hotel.sqlite';

function promisifyDb(db) {
  db.runAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  db.getAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, function (err, row) {
        if (err) return reject(err);
        resolve(row);
      });
    });
  db.allAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, function (err, rows) {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  return db;
}

export async function initializeDatabase() {
  const db = promisifyDb(new sqlite3.Database(DB_PATH));

  await db.runAsync(`PRAGMA foreign_keys = ON`);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      username TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      room_number INTEGER UNIQUE NOT NULL,
      beds INTEGER NOT NULL
    )
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      category TEXT NOT NULL,
      persons INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `);

  // Seed admin user if not exists
  const admin = await db.getAsync(`SELECT * FROM users WHERE username = ?`, ['admin']);
  if (!admin) {
    const hash = await bcrypt.hash('240605', 10);
    await db.runAsync(
      `INSERT INTO users (phone, username, password_hash, role) VALUES (?, ?, ?, ?)`,
      ['+70000000000', 'admin', hash, 'admin']
    );
  }

  // Seed rooms if not exists
  const roomCount = await db.getAsync(`SELECT COUNT(*) as count FROM rooms`);
  if (!roomCount || roomCount.count === 0) {
    // Standard: 20 rooms, room_numbers 1-20, beds 2
    for (let i = 1; i <= 20; i++) {
      await db.runAsync(
        `INSERT INTO rooms (category, room_number, beds) VALUES (?, ?, ?)`,
        ['standard', i, 2]
      );
    }
    // Comfort: 15 rooms, room_numbers 101-115, beds 3
    for (let i = 101; i <= 115; i++) {
      await db.runAsync(
        `INSERT INTO rooms (category, room_number, beds) VALUES (?, ?, ?)`,
        ['comfort', i, 3]
      );
    }
    // Luxe: 10 rooms, room_numbers 201-210, beds 4
    for (let i = 201; i <= 210; i++) {
      await db.runAsync(
        `INSERT INTO rooms (category, room_number, beds) VALUES (?, ?, ?)`,
        ['luxe', i, 4]
      );
    }
  }

  return db;
}

export function getPricingConfig() {
  return {
    standard: { base: 2500, extra: 500, label: 'Стандарт' },
    comfort: { base: 4000, extra: 700, label: 'Комфорт' },
    luxe: { base: 5500, extra: 1000, label: 'Люкс' },
  };
}

export function calculateTotalPrice(categoryKey, persons, nights) {
  const cfg = getPricingConfig()[categoryKey];
  if (!cfg) return 0;
  const extras = Math.max(0, persons - 1);
  const perNight = cfg.base + extras * cfg.extra;
  return perNight * Math.max(1, nights);
}

