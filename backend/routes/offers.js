const express = require('express');
const db      = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ── Submit an offer ─────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { request_id, message } = req.body;
    if (!request_id) return res.status(400).json({ success: false, message: 'request_id is required' });

    const [reqRows] = await db.query('SELECT * FROM help_requests WHERE id = ?', [request_id]);
    if (reqRows.length === 0) return res.status(404).json({ success: false, message: 'Request not found' });
    if (reqRows[0].user_id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot offer help on your own request' });
    }
    if (!['pending','in_progress'].includes(reqRows[0].status)) {
      return res.status(400).json({ success: false, message: 'This request is no longer accepting offers' });
    }

    const [existing] = await db.query(
      'SELECT id FROM help_offers WHERE request_id = ? AND helper_id = ?',
      [request_id, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'You have already offered help on this request' });
    }

    const [result] = await db.query(
      'INSERT INTO help_offers (request_id, helper_id, message) VALUES (?, ?, ?)',
      [request_id, req.user.id, message || null]
    );

    // Notify requester
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, 'New Help Offer', CONCAT(?, ' has offered to help with your request.'), 'offer', ?)`,
      [reqRows[0].user_id, req.user.name, request_id]
    );

    res.status(201).json({ success: true, message: 'Help offer submitted', offer_id: result.insertId });
  } catch (err) {
    console.error('[Offers] Submit error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Get offers for a request ────────────────────────────────
router.get('/request/:request_id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ho.*, u.name AS helper_name, u.profile_picture, u.profession,
             u.location AS helper_location, u.badge_points,
             (SELECT COUNT(*) FROM user_badges ub WHERE ub.user_id = u.id) AS badge_count
      FROM help_offers ho
      JOIN users u ON u.id = ho.helper_id
      WHERE ho.request_id = ?
      ORDER BY ho.created_at DESC`, [req.params.request_id]);

    res.json({ success: true, offers: rows });
  } catch (err) {
    console.error('[Offers] List error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Accept / Reject offer ───────────────────────────────────
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted','rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be accepted or rejected' });
    }

    const [offerRows] = await db.query(`
      SELECT ho.*, hr.user_id AS requester_id, hr.title AS request_title
      FROM help_offers ho
      JOIN help_requests hr ON hr.id = ho.request_id
      WHERE ho.id = ?`, [req.params.id]);

    if (offerRows.length === 0) return res.status(404).json({ success: false, message: 'Offer not found' });
    if (offerRows[0].requester_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await db.query('UPDATE help_offers SET status = ? WHERE id = ?', [status, req.params.id]);

    if (status === 'accepted') {
      await db.query(
        'UPDATE help_requests SET status = "in_progress" WHERE id = ?',
        [offerRows[0].request_id]
      );
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_id)
         VALUES (?, 'Offer Accepted', CONCAT('Your offer to help with "', ?, '" has been accepted!'), 'offer', ?)`,
        [offerRows[0].helper_id, offerRows[0].request_title, offerRows[0].request_id]
      );
    } else {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_id)
         VALUES (?, 'Offer Update', CONCAT('Your offer for "', ?, '" was not selected this time.'), 'offer', ?)`,
        [offerRows[0].helper_id, offerRows[0].request_title, offerRows[0].request_id]
      );
    }

    res.json({ success: true, message: `Offer ${status}` });
  } catch (err) {
    console.error('[Offers] Status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── My offers (helper view) ─────────────────────────────────
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ho.*, hr.title, hr.status AS request_status, hr.urgency_level,
             hr.location AS request_location, c.name AS category_name, c.color AS category_color,
             u.name AS requester_name
      FROM help_offers ho
      JOIN help_requests hr ON hr.id = ho.request_id
      JOIN categories c     ON c.id  = hr.category_id
      JOIN users u          ON u.id  = hr.user_id
      WHERE ho.helper_id = ?
      ORDER BY ho.created_at DESC`, [req.user.id]);

    res.json({ success: true, offers: rows });
  } catch (err) {
    console.error('[Offers] Mine error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
