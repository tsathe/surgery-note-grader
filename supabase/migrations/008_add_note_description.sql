-- Add description field to surgery_notes table
-- This migration adds a description column while keeping the existing ID column

-- Add the description column
ALTER TABLE surgery_notes 
ADD COLUMN description TEXT;

-- Update existing notes with default descriptions
UPDATE surgery_notes 
SET description = 'Note ' || SUBSTRING(id::text, 1, 8)
WHERE description IS NULL;

-- Make description NOT NULL with a default
ALTER TABLE surgery_notes 
ALTER COLUMN description SET NOT NULL;

-- Add a default value for new inserts
ALTER TABLE surgery_notes 
ALTER COLUMN description SET DEFAULT 'Note ' || SUBSTRING(gen_random_uuid()::text, 1, 8);

-- Insert some sample notes with descriptions
INSERT INTO surgery_notes (description, note_text) VALUES
('Note A', 'Elective laparoscopic cholecystectomy for symptomatic cholelithiasis. Critical view obtained. Cystic duct and artery clipped and divided. Gallbladder removed in endocatch. No bile spillage. Discharged home same day with low-fat diet instructions.'),
('Note B', 'Emergency laparoscopic appendectomy for acute appendicitis. Appendix was inflamed and perforated. Performed appendectomy with irrigation. Patient recovered well.'),
('Note C', 'Elective laparoscopic inguinal hernia repair. Mesh placed without tension. Patient tolerated procedure well. Discharged same day with activity restrictions.');
