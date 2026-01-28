-- Run this in Supabase SQL Editor to disable RLS and allow all access
-- This is the issue - RLS is likely blocking your queries!

-- Disable Row Level Security on all tables
ALTER TABLE items DISABLE ROW LEVEL SECURITY;
ALTER TABLE functions DISABLE ROW LEVEL SECURITY;
ALTER TABLE function_items DISABLE ROW LEVEL SECURITY;

-- Verify data exists
SELECT * FROM items;
