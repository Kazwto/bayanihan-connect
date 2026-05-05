const express = require('express');
const db      = require('../config/db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ── Leaderboard ─────────────────────────────────────────────
router.get('/leaderboard', optionalAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.name, u.profile_picture, u.location, u.profession, u.badge_points,
             COUNT(DISTINCT hr_resolved.id)  AS resolved_count,
             COUNT(DISTINCT ho.id)           AS total_offers,
             COUNT(DISTINCT ub.badge_id)     AS badge_count,
             COALESCE(AVG(r.rating), 0)      AS avg_rating
      FROM users u
      LEFT JOIN help_offers ho       ON ho.helper_id = u.id
      LEFT JOIN help_requests hr_resolved
             ON hr_resolved.id = ho.request_id AND hr_resolved.status = 'resolved'
      LEFT JOIN user_badges ub       ON ub.user_id = u.id
      LEFT JOIN ratings r            ON r.helper_id = u.id
      WHERE u.role IN ('helper','both') AND u.is_active = 1
      GROUP BY u.id
      ORDER BY resolved_count DESC, u.badge_points DESC
      LIMIT 20`
    );
    res.json({ success: true, leaderboard: rows });
  } catch (err) {
    console.error('[Users] Leaderboard error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── All badges ──────────────────────────────────────────────
router.get('/badges', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM badges ORDER BY min_points');
    res.json({ success: true, badges: rows });
  } catch (err) {
    console.error('[Users] Badges error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── User badges ─────────────────────────────────────────────
router.get('/:id/badges', optionalAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT b.*, ub.earned_at FROM user_badges ub
      JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id = ?
      ORDER BY ub.earned_at DESC`, [req.params.id]);
    res.json({ success: true, badges: rows });
  } catch (err) {
    console.error('[Users] User badges error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Public user profile ─────────────────────────────────────
router.get('/:id/profile', optionalAuth, async (req, res) => {
  try {
    const [[user]] = await db.query(`
      SELECT u.id, u.name, u.location, u.role, u.profile_picture, u.profession,
             u.badge_points, u.created_at,
             COUNT(DISTINCT hr.id)  AS total_requests,
             COUNT(DISTINCT ho.id)  AS total_offers,
             COALESCE(AVG(r.rating),0) AS avg_rating
      FROM users u
      LEFT JOIN help_requests hr ON hr.user_id = u.id
      LEFT JOIN help_offers ho   ON ho.helper_id = u.id
      LEFT JOIN ratings r        ON r.helper_id  = u.id
      WHERE u.id = ? AND u.is_active = 1
      GROUP BY u.id`, [req.params.id]);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const [badges] = await db.query(`
      SELECT b.* FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = ?`,
      [req.params.id]
    );

    res.json({ success: true, user, badges });
  } catch (err) {
    console.error('[Users] Profile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Notifications ───────────────────────────────────────────
router.get('/notifications/list', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM notifications WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 30`, [req.user.id]);
    const [[{ unread }]] = await db.query(
      'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ success: true, notifications: rows, unread });
  } catch (err) {
    console.error('[Users] Notifications error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/notifications/read', authenticateToken, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('[Users] Mark read error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Rate a helper ───────────────────────────────────────────
router.post('/rate', authenticateToken, async (req, res) => {
  try {
    const { request_id, helper_id, rating, comment } = req.body;
    if (!request_id || !helper_id || !rating) {
      return res.status(400).json({ success: false, message: 'request_id, helper_id, and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const [[req_row]] = await db.query(
      'SELECT user_id FROM help_requests WHERE id = ?', [request_id]
    );
    if (!req_row || req_row.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the requester can rate helpers' });
    }

    await db.query(
      `INSERT INTO ratings (request_id, rater_id, helper_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
      [request_id, req.user.id, helper_id, rating, comment || null]
    );

    res.json({ success: true, message: 'Rating submitted' });
  } catch (err) {
    console.error('[Users] Rate error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
