-- EduTech Cloudflare D1 initial schema (SQLite).
-- All tables are empty until the Firebase data is explicitly migrated.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL DEFAULT '',
  auth_provider TEXT NOT NULL DEFAULT 'pending_migration',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  trial_expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  track TEXT NOT NULL DEFAULT '',
  price_inr REAL NOT NULL DEFAULT 0,
  thumbnail TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'available',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 999,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_courses_public ON courses(published, sort_order);

CREATE TABLE IF NOT EXISTS course_inclusions (
  parent_course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  child_course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(parent_course_id, child_course_id),
  CHECK(parent_course_id <> child_course_id)
);
CREATE INDEX IF NOT EXISTS idx_included_child ON course_inclusions(child_course_id);

CREATE TABLE IF NOT EXISTS lectures (
  id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  trial_enabled INTEGER NOT NULL DEFAULT 0 CHECK(trial_enabled IN (0, 1)),
  free_preview INTEGER NOT NULL DEFAULT 0 CHECK(free_preview IN (0, 1)),
  youtube_id TEXT,
  r2_object_key TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY(course_id, id)
);
CREATE INDEX IF NOT EXISTS idx_lectures_order ON lectures(course_id, sort_order);

CREATE TABLE IF NOT EXISTS enrollments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'admin',
  starts_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER,
  PRIMARY KEY(user_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  lecture_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
  manually_completed INTEGER NOT NULL DEFAULT 0 CHECK(manually_completed IN (0, 1)),
  watched_seconds REAL NOT NULL DEFAULT 0,
  completed_at INTEGER,
  PRIMARY KEY(user_id, course_id, lecture_id),
  FOREIGN KEY(course_id, lecture_id) REFERENCES lectures(course_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff',
  permissions_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  amount_paise INTEGER NOT NULL,
  months INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'created',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  verified_at INTEGER
);

-- Never return lectures.youtube_id, lectures.r2_object_key, private student or
-- payment data through the public course catalog API.
