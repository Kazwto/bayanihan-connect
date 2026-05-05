-- =====================================================
-- Bayanihan Connect - Database Schema
-- MySQL 8.0+ | UTF8MB4
-- =====================================================

CREATE DATABASE IF NOT EXISTS bayanihan_connect
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bayanihan_connect;

-- ── Users ─────────────────────────────────────────
CREATE TABLE users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255)   NOT NULL,
  email           VARCHAR(255)   UNIQUE NOT NULL,
  password        VARCHAR(255)   NOT NULL,
  location        VARCHAR(255)   DEFAULT NULL,
  role            ENUM('requester','helper','both','admin') NOT NULL DEFAULT 'both',
  profile_picture VARCHAR(500)   DEFAULT NULL,
  profession      VARCHAR(255)   DEFAULT NULL,
  badge_points    INT            DEFAULT 0,
  is_active       TINYINT(1)     DEFAULT 1,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Categories ────────────────────────────────────
CREATE TABLE categories (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  color VARCHAR(20)  DEFAULT '#1B4F8A'
);

INSERT INTO categories (name, color) VALUES
  ('Emergency', '#C62828'),
  ('Transport',  '#1565C0'),
  ('Food',       '#E65100'),
  ('Academic',   '#6A1B9A'),
  ('Technical',  '#00695C'),
  ('Other',      '#546E7A');

-- ── Help Requests ─────────────────────────────────
CREATE TABLE help_requests (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT          NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT         NOT NULL,
  category_id   INT          NOT NULL,
  location      VARCHAR(255) DEFAULT NULL,
  urgency_level ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  status        ENUM('pending','in_progress','resolved','cancelled') NOT NULL DEFAULT 'pending',
  image_url     VARCHAR(500) DEFAULT NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- ── Help Offers ───────────────────────────────────
CREATE TABLE help_offers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  request_id  INT  NOT NULL,
  helper_id   INT  NOT NULL,
  message     TEXT DEFAULT NULL,
  status      ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES help_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (helper_id)  REFERENCES users(id)         ON DELETE CASCADE,
  UNIQUE KEY uq_offer (request_id, helper_id)
);

-- ── Messages ──────────────────────────────────────
CREATE TABLE messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT       NOT NULL,
  sender_id  INT       NOT NULL,
  message    TEXT      NOT NULL,
  is_read    TINYINT(1) DEFAULT 0,
  timestamp  TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES help_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id)  REFERENCES users(id)         ON DELETE CASCADE
);

-- ── Badges ────────────────────────────────────────
CREATE TABLE badges (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  icon        VARCHAR(50)  DEFAULT 'star',
  min_points  INT          DEFAULT 0,
  color       VARCHAR(20)  DEFAULT '#F4B942'
);

INSERT INTO badges (name, description, icon, min_points, color) VALUES
  ('Community Starter',    'Completed your first help request',          'seedling', 1,  '#27AE60'),
  ('Fast Responder',       'Responded to 5 or more requests quickly',    'bolt',     5,  '#F39C12'),
  ('Community Supporter',  'Successfully completed 10 help requests',    'hands',    10, '#3498DB'),
  ('Most Helpful Helper',  'Dedicated helper with 25 completed requests','heart',    25, '#E74C3C'),
  ('Bayanihan Champion',   'Elite helper with 50+ completed requests',   'trophy',   50, '#8E44AD');

-- ── User Badges ───────────────────────────────────
CREATE TABLE user_badges (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  user_id   INT NOT NULL,
  badge_id  INT NOT NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_badge (user_id, badge_id)
);

-- ── Notifications ─────────────────────────────────
CREATE TABLE notifications (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  title        VARCHAR(255) NOT NULL,
  message      TEXT         NOT NULL,
  type         ENUM('offer','message','status','badge','system') DEFAULT 'system',
  is_read      TINYINT(1)   DEFAULT 0,
  reference_id INT          DEFAULT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Ratings ───────────────────────────────────────
CREATE TABLE ratings (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  rater_id   INT NOT NULL,
  helper_id  INT NOT NULL,
  rating     INT CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES help_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (rater_id)   REFERENCES users(id)         ON DELETE CASCADE,
  FOREIGN KEY (helper_id)  REFERENCES users(id)         ON DELETE CASCADE,
  UNIQUE KEY uq_rating (request_id, rater_id)
);

-- ── Performance Indexes ───────────────────────────
CREATE INDEX idx_req_user     ON help_requests(user_id);
CREATE INDEX idx_req_status   ON help_requests(status);
CREATE INDEX idx_req_category ON help_requests(category_id);
CREATE INDEX idx_req_location ON help_requests(location(50));
CREATE INDEX idx_offer_req    ON help_offers(request_id);
CREATE INDEX idx_offer_helper ON help_offers(helper_id);
CREATE INDEX idx_msg_req      ON messages(request_id);
CREATE INDEX idx_notif_user   ON notifications(user_id, is_read);
CREATE INDEX idx_users_role   ON users(role);

-- ── Admin Seed Account ────────────────────────────
-- Default: admin@bayanihan.com / Admin@123
-- Hash generated by bcrypt(10): run `node scripts/seed.js` to insert
-- Or replace $2b$10$... with actual bcrypt hash below:
-- INSERT INTO users (name, email, password, role, location)
-- VALUES ('Bayanihan Admin', 'admin@bayanihan.com', '$2b$10$REPLACE_WITH_HASH', 'admin', 'Manila');
