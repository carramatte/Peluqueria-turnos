const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'peluqueria.db');
const db = new Database(DB_PATH);

// ── Activar WAL mode para mejor rendimiento ──
db.pragma('journal_mode = WAL');

// ── Crear tablas ──
db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    duration_min INTEGER NOT NULL DEFAULT 30,
    price REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    client_channel TEXT NOT NULL DEFAULT 'whatsapp',
    service TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'confirmed',
    reminder_sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
  CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
  CREATE INDEX IF NOT EXISTS idx_appointments_phone ON appointments(client_phone);
`);

// ── Datos semilla: servicios de peluquería ──
const insertService = db.prepare(`
  INSERT OR IGNORE INTO services (name, duration_min, price) VALUES (?, ?, ?)
`);

const services = [
  ['Corte de cabello', 30, 5000],
  ['Corte + Barba', 45, 7000],
  ['Tintura', 60, 12000],
  ['Mechas', 90, 15000],
  ['Brushing', 30, 4000],
  ['Tratamiento capilar', 45, 8000],
  ['Alisado', 120, 20000],
  ['Corte infantil', 20, 3500],
];

const insertMany = db.transaction(() => {
  for (const [name, duration, price] of services) {
    insertService.run(name, duration, price);
  }
});
insertMany();

console.log('✅ Base de datos inicializada correctamente');

module.exports = db;
