-- Fix Row Level Security (RLS) Policies for Authentication System
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/YOUR_PROJECT/sql

-- ============================================
-- OPTION 1: Create Policies (Recommended)
-- ============================================
-- This allows all operations (SELECT, INSERT, UPDATE, DELETE) for authenticated and anonymous users
-- Adjust these policies based on your security requirements

-- Drop existing policies if they exist (optional - only if you want to recreate them)
DROP POLICY IF EXISTS "Allow all operations on Authentication Info" ON "Authentication Info";
DROP POLICY IF EXISTS "Allow all operations on Farmer's info" ON "Farmer's info";

-- Create policy for Authentication Info table
-- This allows INSERT, SELECT, UPDATE, DELETE for all users (including anonymous)
CREATE POLICY "Allow all operations on Authentication Info"
  ON "Authentication Info"
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policy for Farmer's info table
-- This allows INSERT, SELECT, UPDATE, DELETE for all users (including anonymous)
-- IMPORTANT: Table name is "Farmer's info" (with capital F)
CREATE POLICY "Allow all operations on Farmer's info"
  ON "Farmer's info"
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- If the policy already exists, you may need to drop it first:
-- DROP POLICY IF EXISTS "Allow all operations on farmer's info" ON "farmer's info";

-- ============================================
-- OPTION 2: Disable RLS (Development Only)
-- ============================================
-- Uncomment the lines below if you want to disable RLS completely
-- (NOT recommended for production)

-- ALTER TABLE "Authentication Info" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Farmer's info" DISABLE ROW LEVEL SECURITY;

-- ============================================
-- Verify RLS Status
-- ============================================
-- Run this to check if RLS is enabled and see existing policies:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('Authentication Info', 'Farmer''s info');

-- To see all policies:
-- SELECT * FROM pg_policies 
-- WHERE tablename IN ('Authentication Info', 'Farmer''s info');

