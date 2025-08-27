-- Enable RLS (Row Level Security)
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create tables
CREATE TABLE IF NOT EXISTS surgery_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  patient_info TEXT,
  surgery_date DATE,
  surgeon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rubric_domains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  examples TEXT NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 5,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID REFERENCES surgery_notes(id) ON DELETE CASCADE,
  grader_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_scores JSONB NOT NULL DEFAULT '{}',
  total_score INTEGER NOT NULL,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_surgery_notes_created_at ON surgery_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rubric_domains_order ON rubric_domains("order");
CREATE INDEX IF NOT EXISTS idx_grades_note_id ON grades(note_id);
CREATE INDEX IF NOT EXISTS idx_grades_grader_id ON grades(grader_id);

-- Enable RLS on tables
ALTER TABLE surgery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Surgery notes: allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read surgery notes" ON surgery_notes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Rubric domains: allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read rubric domains" ON rubric_domains
  FOR SELECT USING (auth.role() = 'authenticated');

-- Grades: allow users to read their own grades and create new grades
CREATE POLICY "Allow users to read their own grades" ON grades
  FOR SELECT USING (auth.uid() = grader_id);

CREATE POLICY "Allow authenticated users to create grades" ON grades
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Admin policies (for users with admin email)
CREATE POLICY "Allow admin to manage surgery notes" ON surgery_notes
  FOR ALL USING (
    auth.role() = 'authenticated' AND 
    auth.jwt() ->> 'email' LIKE '%admin%'
  );

CREATE POLICY "Allow admin to manage rubric domains" ON rubric_domains
  FOR ALL USING (
    auth.role() = 'authenticated' AND 
    auth.jwt() ->> 'email' LIKE '%admin%'
  );

CREATE POLICY "Allow admin to read all grades" ON grades
  FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    auth.jwt() ->> 'email' LIKE '%admin%'
  );

-- Create functions for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_surgery_notes_updated_at 
  BEFORE UPDATE ON surgery_notes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rubric_domains_updated_at 
  BEFORE UPDATE ON rubric_domains 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grades_updated_at 
  BEFORE UPDATE ON grades 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample rubric domains
INSERT INTO rubric_domains (name, description, examples, max_score, "order") VALUES
(
  'Completeness',
  'Assessment of whether all required elements of the surgery note are present and documented.',
  'Examples: Patient demographics, procedure details, findings, complications, post-operative plan',
  5,
  1
),
(
  'Accuracy',
  'Evaluation of the medical accuracy and clinical relevance of the documented information.',
  'Examples: Correct anatomical terms, accurate procedure description, appropriate clinical reasoning',
  5,
  2
),
(
  'Clarity',
  'Assessment of how well the information is presented and communicated.',
  'Examples: Clear language, logical organization, appropriate level of detail',
  5,
  3
),
(
  'Timeliness',
  'Evaluation of whether the note was completed within appropriate timeframes.',
  'Examples: Completed within 24 hours, updated with new findings',
  5,
  4
),
(
  'Compliance',
  'Assessment of adherence to institutional and regulatory requirements.',
  'Examples: Required signatures, proper formatting, legal requirements met',
  5,
  5
)
ON CONFLICT DO NOTHING;
