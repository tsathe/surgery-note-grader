-- Fix grades table UPDATE permissions
-- This migration adds the missing UPDATE policy for grades table
-- so users can edit their own grades after initial submission

-- Add UPDATE policy to allow users to update their own grades
CREATE POLICY "Allow users to update their own grades" ON grades
  FOR UPDATE USING (auth.uid() = grader_id)
  WITH CHECK (auth.uid() = grader_id);

-- Also allow admins to update any grade
CREATE POLICY "Allow admin to update all grades" ON grades
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    auth.jwt() ->> 'email' LIKE '%admin%'
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND 
    auth.jwt() ->> 'email' LIKE '%admin%'
  );
