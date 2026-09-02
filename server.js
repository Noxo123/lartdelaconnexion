require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { z } = require('zod');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: false,
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 100_000
});

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();

if (IS_PROD && (!SESSION_SECRET || SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET doit contenir au moins 32 caractères en production.');
}

app.set('trust proxy', IS_PROD ? 1 : false);
app.disable('x-powered-by');

const dataDir = path.join(__dirname, 'data');
const fs = require('fs');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('client','owner')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS consultations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  requested_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
  room_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_consultations_user ON consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
`);

const sessionMiddleware = session({
  name: IS_PROD ? '__Host-ladc.sid' : 'ladc.sid',
  store: new SQLiteStore({ db: 'sessions.db', dir: dataDir }),
  secret: SESSION_SECRET || 'dev-only-change-this-secret-before-production',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8,
    path: '/'
  }
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://miro.medium.com'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      mediaSrc: ["'self'", 'blob:'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"]
    }
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(sessionMiddleware);

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez plus tard.' }
});

app.use('/api', apiLimiter);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function safeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at
  };
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentification requise.' });
  next();
}

function requireOwner(req, res, next) {
  if (!req.session.userId || req.session.role !== 'owner') {
    return res.status(403).json({ error: 'Accès propriétaire requis.' });
  }
  next();
}

function newCsrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

function checkCsrf(req, res, next) {
  const token = req.get('x-csrf-token');
  const expected = req.session.csrfToken;
  if (!token || !expected || token.length !== expected.length) {
    return res.status(403).json({ error: 'Jeton de sécurité invalide.' });
  }
  const ok = crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!ok) return res.status(403).json({ error: 'Jeton de sécurité invalide.' });
  next();
}

function validateOrigin(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  const host = req.get('host');
  try {
    if (new URL(origin).host !== host) return res.status(403).json({ error: 'Origine non autorisée.' });
  } catch {
    return res.status(403).json({ error: 'Origine invalide.' });
  }
  next();
}

app.use('/api', validateOrigin);

const registerSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(180),
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, 'Le mot de passe doit contenir une minuscule.')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir une majuscule.')
    .regex(/[0-9]/, 'Le mot de passe doit contenir un chiffre.')
});

const loginSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(1).max(128)
});

const consultationSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().max(1500).default(''),
  requestedAt: z.string().datetime({ offset: true })
});

app.get('/api/csrf', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: newCsrfToken(req) });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.json({ user: null });
  }
  res.set('Cache-Control', 'no-store');
  res.json({ user: safeUser(user) });
});

app.post('/api/auth/register', authLimiter, checkCsrf, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données invalides.' });

  const email = normalizeEmail(parsed.data.email);
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse.' });

  const hash = await bcrypt.hash(parsed.data.password, 12);
  const role = ADMIN_EMAIL && email === ADMIN_EMAIL ? 'owner' : 'client';
  const info = db.prepare(`
    INSERT INTO users (first_name, last_name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(parsed.data.firstName, parsed.data.lastName, email, hash, role);

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Impossible de créer la session.' });
    req.session.userId = Number(info.lastInsertRowid);
    req.session.role = role;
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ user: safeUser(user), csrfToken: req.session.csrfToken });
  });
});

app.post('/api/auth/login', authLimiter, checkCsrf, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Identifiants invalides.' });

  const email = normalizeEmail(parsed.data.email);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const valid = user ? await bcrypt.compare(parsed.data.password, user.password_hash) : false;
  if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

  const role = ADMIN_EMAIL && email === ADMIN_EMAIL ? 'owner' : user.role;
  if (role !== user.role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
  db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Impossible de créer la session.' });
    req.session.userId = user.id;
    req.session.role = role;
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    res.json({ user: { ...safeUser(user), role }, csrfToken: req.session.csrfToken });
  });
});

app.post('/api/auth/logout', checkCsrf, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(IS_PROD ? '__Host-ladc.sid' : 'ladc.sid', { path: '/' });
    res.json({ ok: true });
  });
});

app.get('/api/consultations', requireAuth, (req, res) => {
  const rows = req.session.role === 'owner'
    ? db.prepare(`SELECT c.*, u.first_name, u.last_name, u.email FROM consultations c JOIN users u ON u.id = c.user_id ORDER BY c.requested_at ASC`).all()
    : db.prepare(`SELECT c.* FROM consultations c WHERE c.user_id = ? ORDER BY c.requested_at ASC`).all(req.session.userId);
  res.set('Cache-Control', 'no-store');
  res.json({ consultations: rows });
});

app.post('/api/consultations', requireAuth, checkCsrf, (req, res) => {
  const parsed = consultationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Demande invalide.' });
  const date = new Date(parsed.data.requestedAt);
  if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() + 5 * 60_000) {
    return res.status(400).json({ error: 'Choisissez une date future.' });
  }

  const roomToken = crypto.randomBytes(24).toString('hex');
  const info = db.prepare(`INSERT INTO consultations (user_id, subject, message, requested_at, room_token) VALUES (?, ?, ?, ?, ?)`)
    .run(req.session.userId, parsed.data.subject, parsed.data.message, date.toISOString(), roomToken);
  const consultation = db.prepare('SELECT * FROM consultations WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ consultation });
});

app.patch('/api/consultations/:id/status', requireOwner, checkCsrf, (req, res) => {
  const id = Number(req.params.id);
  const parsed = z.object({ status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']) }).safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) return res.status(400).json({ error: 'Requête invalide.' });
  const info = db.prepare('UPDATE consultations SET status = ? WHERE id = ?').run(parsed.data.status, id);
  if (!info.changes) return res.status(404).json({ error: 'Consultation introuvable.' });
  res.json({ ok: true });
});

app.get('/api/consultations/:id/access', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM consultations WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Consultation introuvable.' });
  if (req.session.role !== 'owner' && row.user_id !== req.session.userId) return res.status(403).json({ error: 'Accès refusé.' });
  if (row.status !== 'confirmed') return res.status(409).json({ error: 'Cette consultation n’est pas encore confirmée.' });
  res.json({ consultation: row, iceServers: getIceServers() });
});

function getIceServers() {
  const servers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    servers.push({
      urls: process.env.TURN_URL.split(',').map((s) => s.trim()).filter(Boolean),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    });
  }
  return servers;
}

io.engine.use(sessionMiddleware);

io.use((socket, next) => {
  const sessionData = socket.request.session;
  if (!sessionData?.userId) return next(new Error('unauthorized'));
  next();
});

io.on('connection', (socket) => {
  socket.on('join-consultation', ({ consultationId }) => {
    const id = Number(consultationId);
    if (!Number.isInteger(id)) return;
    const s = socket.request.session;
    const row = db.prepare('SELECT * FROM consultations WHERE id = ?').get(id);
    if (!row || row.status !== 'confirmed') return;
    if (s.role !== 'owner' && row.user_id !== s.userId) return;

    const room = `consultation:${id}:${row.room_token}`;
    const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
    if (roomSize >= 2) return socket.emit('room-full');
    socket.join(room);
    socket.data.room = room;
    socket.emit('room-joined', { initiator: roomSize === 0 });
    if (roomSize === 1) socket.to(room).emit('peer-ready');
  });

  socket.on('signal', (payload) => {
    if (!socket.data.room) return;
    const allowed = ['offer', 'answer', 'candidate'];
    if (!payload || !allowed.includes(payload.type)) return;
    socket.to(socket.data.room).emit('signal', payload);
  });

  socket.on('leave-consultation', () => {
    if (!socket.data.room) return;
    socket.to(socket.data.room).emit('peer-left');
    socket.leave(socket.data.room);
    socket.data.room = null;
  });

  socket.on('disconnecting', () => {
    if (socket.data.room) socket.to(socket.data.room).emit('peer-left');
  });
});

app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: IS_PROD ? '1h' : 0,
  index: false
}));

app.get(['/','/connexion','/inscription','/espace','/consultation/:id'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Route API introuvable.' }));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Erreur interne.' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`L'Art de la Connexion lancé sur le port ${PORT} (${NODE_ENV}).`);
});
