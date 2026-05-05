const bcrypt = require('bcryptjs');
const db     = require('../config/db');
require('dotenv').config({ path: '../.env' });

async function seed() {
  try {
    const hash = await bcrypt.hash('Admin@123', 10);
    await db.query(
      `INSERT INTO users (name, email, password, role, location)
       VALUES (?, ?, ?, 'admin', 'Manila, Philippines')
       ON DUPLICATE KEY UPDATE password = VALUES(password)`,
      ['Bayanihan Admin', 'admin@bayanihan.com', hash]
    );
    console.log('[Seed] Admin account created: admin@bayanihan.com / Admin@123');
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
  }
}

seed();
