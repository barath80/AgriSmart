-- Run this in Supabase SQL Editor to check the exact table name
-- This will show all tables in the public schema

SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
AND (tablename LIKE '%farmer%' OR tablename LIKE '%Farmer%')
ORDER BY tablename;

-- Also check for tables with special characters
SELECT 
    schemaname,
    tablename
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

