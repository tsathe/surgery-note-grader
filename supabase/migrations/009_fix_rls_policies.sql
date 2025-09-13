-- Fix RLS policies to allow all authenticated users to manage surgery notes
-- This migration updates the policies to be more permissive for testing

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow admin to manage surgery notes" ON surgery_notes;
DROP POLICY IF EXISTS "Allow admin to manage rubric domains" ON rubric_domains;

-- Create more permissive policies for authenticated users
CREATE POLICY "Allow authenticated users to manage surgery notes" ON surgery_notes
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage rubric domains" ON rubric_domains
  FOR ALL USING (auth.role() = 'authenticated');

-- Also allow all authenticated users to read all grades (not just their own)
DROP POLICY IF EXISTS "Allow users to read their own grades" ON grades;
CREATE POLICY "Allow authenticated users to read all grades" ON grades
  FOR SELECT USING (auth.role() = 'authenticated');
