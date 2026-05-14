const bcrypt = require('bcryptjs');
const db     = require('../config/db');
require('dotenv').config({ path: '../.env' });

async function seed() {
  try {
    // 1) Seed Admin Account
    const hash = await bcrypt.hash('Admin@123', 10);
    await db.query(
      `INSERT INTO users (name, email, password, role, location)
       VALUES (?, ?, ?, 'admin', ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password)`,
      ['Bayanihan Admin', 'admin@bayanihan.com', hash, 'Manila, Philippines']
    );
    console.log('[Seed] Admin account created: admin@bayanihan.com / Admin@123');

    // 2) Seed Badges (badge-icons.svg ids: seedling/bolt/hands/heart/trophy/star)
    // Ensure idempotency (avoid duplicate badge rows)
    await db.query('DELETE FROM badges');
    const badges = [
      {
        name:        'Community Starter',
        description: 'Completed your first help request',
        icon:        'seedling',
        min_points:  1,
        color:       '#27AE60'
      },
      {
        name:        'Fast Responder',
        description: 'Responded to 5 or more requests quickly',
        icon:        'bolt',
        min_points:  5,
        color:       '#F39C12'
      },
      {
        name:        'Community Supporter',
        description: 'Successfully completed 10 help requests',
        icon:        'hands',
        min_points:  10,
        color:       '#3498DB'
      },
      {
        name:        'Most Helpful Helper',
        description: 'Dedicated helper with 25 completed requests',
        icon:        'heart',
        min_points:  25,
        color:       '#E74C3C'
      },
      {
        name:        'Bayanihan Champion',
        description: 'Elite helper with 50+ completed requests',
        icon:        'trophy',
        min_points:  50,
        color:       '#8E44AD'
      }
    ];

    for (const b of badges) {
      await db.query(
        `INSERT INTO badges (name, description, icon, min_points, color)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           description = VALUES(description),
           icon = VALUES(icon),
           min_points = VALUES(min_points),
           color = VALUES(color)`,
        [b.name, b.description, b.icon, b.min_points, b.color]
      );
    }
    console.log('[Seed] Badges seeded/updated');

    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
  }
}

seed();
