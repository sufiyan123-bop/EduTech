-- Group lessons within each included course into chapters.
ALTER TABLE lectures ADD COLUMN chapter TEXT NOT NULL DEFAULT 'General';
CREATE INDEX IF NOT EXISTS idx_lectures_chapter ON lectures(course_id, chapter, sort_order);
