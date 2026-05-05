const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../config/db');
const upload   = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// ── Register ────────────────────────────────────────────────
router.post('/register', upload.single('profile_picture'), async (req, res) => {
  try {
    const { name, email, password, location, role, profession } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hash    = await bcrypt.hash(password, 10);
    const picUrl  = req.file ? `/uploads/${req.file.filename}` : null;
    const userRole = ['requester', 'helper', 'both'].includes(role) ? role : 'both';

    const [result] = await db.query(
      `INSERT INTO users (name, email, password, location, role, profile_picture, profession)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), email.toLowerCase(), hash, location || null, userRole, picUrl, profession || null]
    );

    const token = jwt.sign(
      { id: result.insertId, email: email.toLowerCase(), role: userRole, name: name.trim() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: result.insertId,
        name: name.trim(),
        email: email.toLowerCase(),
        role: userRole,
        location: location || null,
        profession: profession || null,
        profile_picture: picUrl
      }
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// ── Login ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email.toLowerCase()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id:              user.id,
        name:            user.name,
        email:           user.email,
        role:            user.role,
        location:        user.location,
        profession:      user.profession,
        profile_picture: user.profile_picture,
        badge_points:    user.badge_points
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// ── Get current user ────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.location, u.role, u.profile_picture, u.profession,
              u.badge_points, u.created_at,
              (SELECT COUNT(*) FROM help_requests WHERE user_id = u.id) AS total_requests,
              (SELECT COUNT(*) FROM help_offers WHERE helper_id = u.id) AS total_offers,
              (SELECT COUNT(*) FROM help_requests hr
               JOIN help_offers ho ON ho.request_id = hr.id
               WHERE ho.helper_id = u.id AND hr.status = 'resolved') AS resolved_count
       FROM users u WHERE u.id = ? AND u.is_active = 1`,
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('[Auth] Me error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Update profile ──────────────────────────────────────────
router.put('/profile', authenticateToken, upload.single('profile_picture'), async (req, res) => {
  try {
    const { name, location, role, profession } = req.body;
    const updates = {};

    if (name)       updates.name       = name.trim();
    if (location)   updates.location   = location;
    if (role && ['requester','helper','both'].includes(role)) updates.role = role;
    if (profession) updates.profession = profession;
    if (req.file)   updates.profile_picture = `/uploads/${req.file.filename}`;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const cols   = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.user.id];
    await db.query(`UPDATE users SET ${cols} WHERE id = ?`, values);

    const [rows] = await db.query(
      'SELECT id, name, email, location, role, profile_picture, profession, badge_points FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({ success: true, message: 'Profile updated', user: rows[0] });
  } catch (err) {
    console.error('[Auth] Profile update error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Change password ─────────────────────────────────────────
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Both passwords are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const match  = await bcrypt.compare(current_password, rows[0].password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('[Auth] Password change error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
