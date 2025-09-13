-- Simplify surgery_notes table to only have note_id and note_text
-- This migration removes unnecessary fields and keeps only essential columns

-- First, create a backup of existing data if any
CREATE TABLE IF NOT EXISTS surgery_notes_backup AS 
SELECT * FROM surgery_notes;

-- Drop the existing table
DROP TABLE IF EXISTS surgery_notes CASCADE;

-- Recreate the simplified table
CREATE TABLE surgery_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_surgery_notes_created_at ON surgery_notes(created_at DESC);

-- Enable RLS
ALTER TABLE surgery_notes ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
CREATE POLICY "Allow authenticated users to read surgery notes" ON surgery_notes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin to manage surgery notes" ON surgery_notes
  FOR ALL USING (
    auth.role() = 'authenticated' AND 
    auth.jwt() ->> 'email' LIKE '%admin%'
  );

-- Recreate trigger for updated_at
CREATE TRIGGER update_surgery_notes_updated_at 
  BEFORE UPDATE ON surgery_notes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample notes
INSERT INTO surgery_notes (note_text) VALUES
('Elective laparoscopic cholecystectomy for symptomatic cholelithiasis. Critical view obtained. Cystic duct and artery clipped and divided. Gallbladder removed in endocatch. No bile spillage. Discharged home same day with low-fat diet instructions.'),
('Emergency laparoscopic appendectomy for acute appendicitis. Appendix was inflamed and perforated. Performed appendectomy with irrigation. Patient recovered well.'),
('Elective laparoscopic inguinal hernia repair. Mesh placed without tension. Patient tolerated procedure well. Discharged same day with activity restrictions.');
