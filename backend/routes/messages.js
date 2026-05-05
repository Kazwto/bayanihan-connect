const express = require('express');
const db      = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ── Get messages for a request ──────────────────────────────
router.get('/:request_id', authenticateToken, async (req, res) => {
  try {
    const { request_id } = req.params;

    // Verify user is involved in the request
    const [access] = await db.query(`
      SELECT 1 FROM help_requests WHERE id = ? AND user_id = ?
      UNION
      SELECT 1 FROM help_offers WHERE request_id = ? AND helper_id = ?
      UNION
      SELECT 1 FROM users WHERE id = ? AND role = 'admin'`,
      [request_id, req.user.id, request_id, req.user.id, req.user.id]
    );

    if (access.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these messages' });
    }

    const [messages] = await db.query(`
      SELECT m.*, u.name AS sender_name, u.profile_picture, u.role AS sender_role
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.request_id = ?
      ORDER BY m.timestamp ASC`, [request_id]);

    // Mark messages as read
    await db.query(
      'UPDATE messages SET is_read = 1 WHERE request_id = ? AND sender_id != ?',
      [request_id, req.user.id]
    );

    res.json({ success: true, messages });
  } catch (err) {
    console.error('[Messages] Get error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Send a message ──────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { request_id, message } = req.body;
    if (!request_id || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'request_id and message are required' });
    }

    // Verify user is involved
    const [reqRows] = await db.query('SELECT * FROM help_requests WHERE id = ?', [request_id]);
    if (reqRows.length === 0) return res.status(404).json({ success: false, message: 'Request not found' });

    const isRequester = reqRows[0].user_id === req.user.id;
    const [offerRows] = await db.query(
      'SELECT id FROM help_offers WHERE request_id = ? AND helper_id = ? AND status = "accepted"',
      [request_id, req.user.id]
    );
    const isAcceptedHelper = offerRows.length > 0;
    const isAdmin = req.user.role === 'admin';

    if (!isRequester && !isAcceptedHelper && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only accepted helpers can send messages' });
    }

    const [result] = await db.query(
      'INSERT INTO messages (request_id, sender_id, message) VALUES (?, ?, ?)',
      [request_id, req.user.id, message.trim()]
    );

    // Notify the other party
    const recipientId = isRequester ? (offerRows[0]?.helper_id || null) : reqRows[0].user_id;
    if (recipientId) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_id)
         VALUES (?, 'New Message', CONCAT('You have a new message from ', ?), 'message', ?)`,
        [recipientId, req.user.name, request_id]
      );
    }

    const [[newMsg]] = await db.query(`
      SELECT m.*, u.name AS sender_name, u.profile_picture, u.role AS sender_role
      FROM messages m JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?`, [result.insertId]);

    res.status(201).json({ success: true, message: newMsg });
  } catch (err) {
    console.error('[Messages] Send error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Unread message count ────────────────────────────────────
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const [[{ count }]] = await db.query(`
      SELECT COUNT(*) AS count FROM messages m
      JOIN help_requests hr ON hr.id = m.request_id
      LEFT JOIN help_offers ho ON ho.request_id = m.request_id AND ho.helper_id = ?
      WHERE m.sender_id != ?
        AND m.is_read = 0
        AND (hr.user_id = ? OR ho.helper_id = ?)`,
      [req.user.id, req.user.id, req.user.id, req.user.id]
    );
    res.json({ success: true, count });
  } catch (err) {
    console.error('[Messages] Unread count error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
