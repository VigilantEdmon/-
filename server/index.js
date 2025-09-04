import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { format, parse, isAfter, isBefore, isEqual, differenceInCalendarDays, isValid } from 'date-fns';
import { initializeDatabase, calculateTotalPrice } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwt';

app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(express.static('/workspace/public'));

const dbPromise = initializeDatabase();

function parseRuDate(d) {
  try {
    const parsed = parse(d, 'dd.MM.yyyy', new Date());
    return isValid(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

function formatRuDate(date) {
  try {
    return format(date, 'dd.MM.yyyy');
  } catch (e) {
    return '';
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const { phone, username, password } = req.body || {};
  if (!phone || !username || !password) return res.status(400).json({ error: 'Необходимо указать телефон, логин и пароль.' });
  try {
    const db = await dbPromise;
    const existing = await db.getAsync(`SELECT id FROM users WHERE username = ? OR phone = ?`, [username, phone]);
    if (existing) return res.status(409).json({ error: 'Пользователь с таким логином или телефоном уже существует.' });
    const hash = await bcrypt.hash(password, 10);
    const result = await db.runAsync(
      `INSERT INTO users (phone, username, password_hash, role) VALUES (?, ?, ?, 'user')`,
      [phone, username, hash]
    );
    const token = jwt.sign({ id: result.lastID, username, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, username, role: 'user' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Укажите логин и пароль.' });
  try {
    const db = await dbPromise;
    const user = await db.getAsync(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!user) return res.status(401).json({ error: 'Неверные учетные данные.' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Неверные учетные данные.' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, username: user.username, role: user.role });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Helper to find available rooms
async function findAvailableRoom(db, category, startDate, endDate) {
  const rooms = await db.allAsync(`SELECT * FROM rooms WHERE category = ? ORDER BY room_number ASC`, [category]);
  for (const room of rooms) {
    const overlaps = await db.getAsync(
      `SELECT id FROM bookings WHERE room_id = ? AND NOT (date(end_date) <= date(?) OR date(start_date) >= date(?))`,
      [room.id, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')]
    );
    if (!overlaps) return room;
  }
  return null;
}

function toIso(date) {
  return format(date, 'yyyy-MM-dd');
}

// Rooms list with optional availability
app.get('/api/rooms', async (req, res) => {
  try {
    const db = await dbPromise;
    const { category, start, end, persons } = req.query;
    let startDate = start ? parseRuDate(start) : null;
    let endDate = end ? parseRuDate(end) : null;
    let personsNum = persons ? parseInt(String(persons), 10) : 1;
    if (startDate && endDate && isAfter(startDate, endDate)) {
      return res.status(400).json({ error: 'Дата выезда должна быть позже даты заезда.' });
    }

    const where = [];
    const params = [];
    if (category) {
      where.push('category = ?');
      params.push(String(category));
    }
    const rows = await db.allAsync(`SELECT * FROM rooms ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY room_number ASC`, params);

    const nights = startDate && endDate ? Math.max(1, differenceInCalendarDays(endDate, startDate)) : 1;
    const response = [];

    for (const room of rows) {
      let isFree = true;
      let until = null;
      if (startDate && endDate) {
        const overlapping = await db.getAsync(
          `SELECT id, end_date FROM bookings WHERE room_id = ? AND NOT (date(end_date) <= date(?) OR date(start_date) >= date(?)) ORDER BY end_date DESC LIMIT 1`,
          [room.id, toIso(startDate), toIso(endDate)]
        );
        if (overlapping) {
          isFree = false;
          until = format(parse(overlapping.end_date, 'yyyy-MM-dd', new Date()), 'dd.MM.yyyy');
        }
      }
      const total = calculateTotalPrice(room.category, personsNum, nights);
      response.push({
        id: room.id,
        category: room.category,
        roomNumber: room.room_number,
        beds: room.beds,
        available: isFree,
        until,
        nights,
        persons: personsNum,
        totalPrice: total,
      });
    }

    return res.json(response);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Rooms status for admin
app.get('/api/rooms/status', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await dbPromise;
    const rooms = await db.allAsync(`SELECT * FROM rooms ORDER BY category, room_number`);
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    const result = [];
    for (const room of rooms) {
      const current = await db.getAsync(
        `SELECT end_date FROM bookings WHERE room_id = ? AND date(start_date) <= date(?) AND date(end_date) > date(?) ORDER BY end_date DESC LIMIT 1`,
        [room.id, todayIso, todayIso]
      );
      const future = await db.getAsync(
        `SELECT end_date FROM bookings WHERE room_id = ? AND date(start_date) > date(?) ORDER BY end_date DESC LIMIT 1`,
        [room.id, todayIso]
      );
      let status = 'Свободно';
      let until = null;
      if (current) {
        status = 'Занято';
        until = format(parse(current.end_date, 'yyyy-MM-dd', new Date()), 'dd.MM.yyyy');
      } else if (future) {
        status = 'Занято';
        until = format(parse(future.end_date, 'yyyy-MM-dd', new Date()), 'dd.MM.yyyy');
      }
      result.push({ id: room.id, category: room.category, roomNumber: room.room_number, beds: room.beds, status, until });
    }
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Create booking
app.post('/api/bookings', async (req, res) => {
  const { fullName, phone, email, category, persons, startDate: startStr, endDate: endStr } = req.body || {};
  if (!fullName || !phone || !email || !category || !persons || !startStr || !endStr) {
    return res.status(400).json({ error: 'Заполните все обязательные поля.' });
  }
  const startDate = parseRuDate(startStr);
  const endDate = parseRuDate(endStr);
  if (!startDate || !endDate || isAfter(startDate, endDate)) {
    return res.status(400).json({ error: 'Некорректные даты.' });
  }
  try {
    const db = await dbPromise;
    const room = await findAvailableRoom(db, category, startDate, endDate);
    if (!room) return res.status(409).json({ error: 'К сожалению, нет свободных номеров выбранной категории на указанные даты.' });
    const createdAtIso = format(new Date(), 'yyyy-MM-dd');
    const token = req.headers['authorization']?.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.id;
      } catch {}
    }
    await db.runAsync(
      `INSERT INTO bookings (user_id, full_name, phone, email, category, persons, room_id, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fullName, phone, email, category, parseInt(persons, 10), room.id, toIso(startDate), toIso(endDate), createdAtIso]
    );
    return res.json({ success: true, roomNumber: room.room_number, message: 'Бронирование успешно оформлено.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// List bookings (admin)
app.get('/api/bookings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.allAsync(`
      SELECT b.id, b.full_name, b.phone, b.email, b.category, b.persons, b.start_date, b.end_date, b.created_at, r.room_number
      FROM bookings b JOIN rooms r ON b.room_id = r.id
      ORDER BY date(b.start_date) DESC
    `);
    const formatted = rows.map(r => ({
      id: r.id,
      fullName: r.full_name,
      phone: r.phone,
      email: r.email,
      category: r.category,
      persons: r.persons,
      startDate: format(parse(r.start_date, 'yyyy-MM-dd', new Date()), 'dd.MM.yyyy'),
      endDate: format(parse(r.end_date, 'yyyy-MM-dd', new Date()), 'dd.MM.yyyy'),
      createdAt: format(parse(r.created_at, 'yyyy-MM-dd', new Date()), 'dd.MM.yyyy'),
      roomNumber: r.room_number,
    }));
    return res.json(formatted);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`The Villa server running on http://localhost:${PORT}`);
});

// Summary endpoint: counts of rooms by category and occupancy (today)
app.get('/api/summary', async (req, res) => {
  try {
    const db = await dbPromise;
    const categories = ['standard', 'comfort', 'luxe'];
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    const result = {};
    let overallTotal = 0;
    let overallOccupied = 0;
    for (const cat of categories) {
      const totalRow = await db.getAsync(`SELECT COUNT(*) AS c FROM rooms WHERE category = ?`, [cat]);
      const occRow = await db.getAsync(
        `SELECT COUNT(DISTINCT b.room_id) AS c FROM bookings b JOIN rooms r ON b.room_id = r.id
         WHERE r.category = ? AND date(b.start_date) <= date(?) AND date(b.end_date) > date(?)`,
        [cat, todayIso, todayIso]
      );
      const total = totalRow?.c || 0;
      const occupied = occRow?.c || 0;
      const free = Math.max(0, total - occupied);
      result[cat] = { total, occupied, free };
      overallTotal += total;
      overallOccupied += occupied;
    }
    return res.json({ categories: result, overall: { total: overallTotal, occupied: overallOccupied, free: Math.max(0, overallTotal - overallOccupied) } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
});

