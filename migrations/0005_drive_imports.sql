-- Prepared jobs only. Google Drive files and R2 videos are never changed by this migration.
CREATE TABLE IF NOT EXISTS drive_import_jobs (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  drive_folder_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_drive_import_jobs_course
 ON drive_import_jobs(course_id,created_at DESC);

CREATE TABLE IF NOT EXISTS drive_import_items (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES drive_import_jobs(id) ON DELETE RESTRICT,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  drive_file_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  title TEXT NOT NULL,
  chapter TEXT NOT NULL DEFAULT 'General',
  sort_order INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  lecture_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','uploading','finalizing','completed')),
  upload_id TEXT,
  parts_json TEXT NOT NULL DEFAULT '[]',
  next_part INTEGER NOT NULL DEFAULT 1,
  lease_token TEXT,
  lease_expires_at INTEGER,
  last_error TEXT,
  completed_at INTEGER,
  UNIQUE(course_id,drive_file_id),
  UNIQUE(r2_key),
  UNIQUE(course_id,lecture_id)
);
CREATE INDEX IF NOT EXISTS idx_drive_import_items_job
 ON drive_import_items(job_id,sort_order);
