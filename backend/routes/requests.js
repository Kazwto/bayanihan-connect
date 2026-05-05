const express = require('express');
const db      = require('../config/db');
const upload  = require('../middleware/upload');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ── List / Search requests ──────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { status, category, location, urgency, search, limit = 20, offset = 0 } = req.query;
    let sql = `
      SELECT hr.*, u.name AS requester_name, u.profile_picture, u.location AS user_location,
             c.name AS category_name, c.color AS category_color,
             (SELECT COUNT(*) FROM help_offers ho WHERE ho.request_id = hr.id) AS offer_count
      FROM help_requests hr
      JOIN users u      ON u.id = hr.user_id
      JOIN categories c ON c.id = hr.category_id
      WHERE hr.id IS NOT NULL`;
    const params = [];

    if (status)   { sql += ' AND hr.status = ?';        params.push(status); }
    if (category) { sql += ' AND c.name = ?';           params.push(category); }
    if (urgency)  { sql += ' AND hr.urgency_level = ?'; params.push(urgency); }
    if (location) { sql += ' AND hr.location LIKE ?';   params.push(`%${location}%`); }
    if (search)   {
      sql += ' AND (hr.title LIKE ? OR hr.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY hr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM help_requests hr
       JOIN categories c ON c.id = hr.category_id
       WHERE 1=1
       ${status   ? ' AND hr.status = ?'         : ''}
       ${category ? ' AND c.name = ?'            : ''}
       ${urgency  ? ' AND hr.urgency_level = ?'  : ''}
       ${location ? ' AND hr.location LIKE ?'    : ''}
       ${search   ? ' AND (hr.title LIKE ? OR hr.description LIKE ?)' : ''}`,
      params.slice(0, -2)
    );

    res.json({ success: true, requests: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    console.error('[Requests] List error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Get single request ──────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT hr.*, u.name AS requester_name, u.profile_picture, u.location AS user_location,
             c.name AS category_name, c.color AS category_color
      FROM help_requests hr
      JOIN users u      ON u.id = hr.user_id
      JOIN categories c ON c.id = hr.category_id
      WHERE hr.id = ?`, [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Request not found' });

    const [offers] = await db.query(`
      SELECT ho.*, u.name AS helper_name, u.profile_picture, u.profession, u.badge_points,
             u.location AS helper_location
      FROM help_offers ho
      JOIN users u ON u.id = ho.helper_id
      WHERE ho.request_id = ?
      ORDER BY ho.created_at DESC`, [req.params.id]);

    res.json({ success: true, request: rows[0], offers });
  } catch (err) {
    console.error('[Requests] Get error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Create request ──────────────────────────────────────────
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, description, category_id, location, urgency_level } = req.body;

    if (!title || !description || !category_id) {
      return res.status(400).json({ success: false, message: 'Title, description, and category are required' });
    }

    const validUrgency = ['low','medium','high','critical'];
    const urgency = validUrgency.includes(urgency_level) ? urgency_level : 'medium';
    const imgUrl  = req.file ? `/uploads/${req.file.filename}` : null;

    const [result] = await db.query(
      `INSERT INTO help_requests (user_id, title, description, category_id, location, urgency_level, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, title.trim(), description.trim(), category_id, location || null, urgency, imgUrl]
    );

    // Notify potential helpers (system notification)
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id)
       SELECT id, 'New Help Request', CONCAT('A new request has been posted: ', ?), 'system', ?
       FROM users WHERE role IN ('helper','both') AND id != ? LIMIT 50`,
      [title.trim(), result.insertId, req.user.id]
    );

    const [newReq] = await db.query(
      `SELECT hr.*, c.name AS category_name, c.color AS category_color
       FROM help_requests hr JOIN categories c ON c.id = hr.category_id WHERE hr.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: 'Help request created', request: newReq[0] });
  } catch (err) {
    console.error('[Requests] Create error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Update request ──────────────────────────────────────────
router.put('/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM help_requests WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Request not found' });

    const request = rows[0];
    if (request.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { title, description, category_id, location, urgency_level, status } = req.body;
    const updates = {};

    if (title)         updates.title         = title.trim();
    if (description)   updates.description   = description.trim();
    if (category_id)   updates.category_id   = category_id;
    if (location)      updates.location      = location;
    if (urgency_level) updates.urgency_level = urgency_level;
    if (status && ['pending','in_progress','resolved','cancelled'].includes(status)) {
      updates.status = status;
      // Award badge points when resolved
      if (status === 'resolved') {
        const [offers] = await db.query(
          'SELECT helper_id FROM help_offers WHERE request_id = ? AND status = "accepted"',
          [req.params.id]
        );
        for (const offer of offers) {
          await db.query('UPDATE users SET badge_points = badge_points + 1 WHERE id = ?', [offer.helper_id]);
          await checkAndAwardBadges(offer.helper_id);
          await db.query(
            `INSERT INTO notifications (user_id, title, message, type, reference_id)
             VALUES (?, 'Request Resolved', 'Your help was marked as resolved. Great work!', 'status', ?)`,
            [offer.helper_id, req.params.id]
          );
        }
      }
    }
    if (req.file) updates.image_url = `/uploads/${req.file.filename}`;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const cols   = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    await db.query(`UPDATE help_requests SET ${cols} WHERE id = ?`, values);

    res.json({ success: true, message: 'Request updated' });
  } catch (err) {
    console.error('[Requests] Update error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Delete request ──────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT user_id FROM help_requests WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Request not found' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await db.query('DELETE FROM help_requests WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Request deleted' });
  } catch (err) {
    console.error('[Requests] Delete error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── My requests ─────────────────────────────────────────────
router.get('/user/mine', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT hr.*, c.name AS category_name, c.color AS category_color,
             (SELECT COUNT(*) FROM help_offers ho WHERE ho.request_id = hr.id) AS offer_count,
             (SELECT COUNT(*) FROM help_offers ho WHERE ho.request_id = hr.id AND ho.status='accepted') AS accepted_count
      FROM help_requests hr
      JOIN categories c ON c.id = hr.category_id
      WHERE hr.user_id = ?
      ORDER BY hr.created_at DESC`, [req.user.id]);

    res.json({ success: true, requests: rows });
  } catch (err) {
    console.error('[Requests] Mine error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Helper: check and award badges ─────────────────────────
async function checkAndAwardBadges(userId) {
  const [[user]] = await db.query('SELECT badge_points FROM users WHERE id = ?', [userId]);
  const points   = user.badge_points;
  const [badges] = await db.query('SELECT * FROM badges WHERE min_points <= ? ORDER BY min_points', [points]);

  for (const badge of badges) {
    await db.query(
      'INSERT IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)',
      [userId, badge.id]
    );
  }

  // Notify newly earned badges
  const [newBadges] = await db.query(`
    SELECT b.name FROM user_badges ub
    JOIN badges b ON b.id = ub.badge_id
    WHERE ub.user_id = ? AND ub.earned_at >= NOW() - INTERVAL 1 MINUTE`, [userId]);

  for (const b of newBadges) {
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, 'Badge Earned!', CONCAT('You earned the "', ?, '" badge!'), 'badge')`,
      [userId, b.name]
    );
  }
}

module.exports = router;
