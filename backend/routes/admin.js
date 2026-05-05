const express = require('express');
const db      = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

// ── Dashboard stats ─────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [[users]]    = await db.query('SELECT COUNT(*) AS total FROM users WHERE role != "admin"');
    const [[requests]] = await db.query('SELECT COUNT(*) AS total FROM help_requests');
    const [[pending]]  = await db.query('SELECT COUNT(*) AS total FROM help_requests WHERE status = "pending"');
    const [[resolved]] = await db.query('SELECT COUNT(*) AS total FROM help_requests WHERE status = "resolved"');
    const [[offers]]   = await db.query('SELECT COUNT(*) AS total FROM help_offers');
    const [[msgs]]     = await db.query('SELECT COUNT(*) AS total FROM messages');

    const [catStats] = await db.query(`
      SELECT c.name, c.color, COUNT(hr.id) AS count
      FROM categories c LEFT JOIN help_requests hr ON hr.category_id = c.id
      GROUP BY c.id`);

    const [recent] = await db.query(`
      SELECT hr.id, hr.title, hr.status, hr.created_at, hr.urgency_level,
             u.name AS requester_name, c.name AS category_name
      FROM help_requests hr
      JOIN users u      ON u.id = hr.user_id
      JOIN categories c ON c.id = hr.category_id
      ORDER BY hr.created_at DESC LIMIT 10`);

    res.json({
      success: true,
      stats: {
        total_users:    users.total,
        total_requests: requests.total,
        pending:        pending.total,
        resolved:       resolved.total,
        total_offers:   offers.total,
        total_messages: msgs.total,
        category_stats: catStats,
        recent_requests: recent
      }
    });
  } catch (err) {
    console.error('[Admin] Stats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── All users ───────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { search, role, limit = 25, offset = 0 } = req.query;
    let sql = `SELECT u.id, u.name, u.email, u.location, u.role, u.profile_picture,
                      u.profession, u.badge_points, u.is_active, u.created_at,
                      COUNT(DISTINCT hr.id) AS request_count
               FROM users u
               LEFT JOIN help_requests hr ON hr.user_id = u.id
               WHERE 1=1`;
    const params = [];

    if (search) { sql += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (role)   { sql += ' AND u.role = ?'; params.push(role); }

    sql += ' GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);
    res.json({ success: true, users: rows });
  } catch (err) {
    console.error('[Admin] Users error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Toggle user active status ───────────────────────────────
router.put('/users/:id/toggle', async (req, res) => {
  try {
    const [[user]] = await db.query('SELECT is_active FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [user.is_active ? 0 : 1, req.params.id]);
    res.json({ success: true, message: `User ${user.is_active ? 'deactivated' : 'activated'}` });
  } catch (err) {
    console.error('[Admin] Toggle user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── All requests (admin) ────────────────────────────────────
router.get('/requests', async (req, res) => {
  try {
    const { status, category, limit = 25, offset = 0 } = req.query;
    let sql = `SELECT hr.*, u.name AS requester_name, u.email AS requester_email,
                      c.name AS category_name,
                      (SELECT COUNT(*) FROM help_offers ho WHERE ho.request_id = hr.id) AS offer_count
               FROM help_requests hr
               JOIN users u      ON u.id = hr.user_id
               JOIN categories c ON c.id = hr.category_id
               WHERE 1=1`;
    const params = [];
    if (status)   { sql += ' AND hr.status = ?';  params.push(status); }
    if (category) { sql += ' AND c.name = ?';     params.push(category); }
    sql += ' ORDER BY hr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);
    res.json({ success: true, requests: rows });
  } catch (err) {
    console.error('[Admin] All requests error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Delete any request (admin) ──────────────────────────────
router.delete('/requests/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM help_requests WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, message: 'Request deleted by admin' });
  } catch (err) {
    console.error('[Admin] Delete request error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Update request status (admin) ──────────────────────────
router.put('/requests/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pending','in_progress','resolved','cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    await db.query('UPDATE help_requests SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    console.error('[Admin] Update status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── System broadcast notification ──────────────────────────
router.post('/broadcast', async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, message: 'Title and message required' });
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       SELECT id, ?, ?, 'system' FROM users WHERE is_active = 1`,
      [title, message]
    );
    res.json({ success: true, message: 'Broadcast sent' });
  } catch (err) {
    console.error('[Admin] Broadcast error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
