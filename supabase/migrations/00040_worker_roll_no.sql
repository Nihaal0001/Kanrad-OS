-- ============================================================================
-- Worker roll numbers (sheet order)
--
-- Adds a roll_no to profiles and backfills it in the order workers appear on
-- the daily attendance sheet, so payroll / worker lists can show the same
-- numbering and sort order instead of alphabetical.
--
-- Apply in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roll_no INTEGER;

UPDATE profiles p SET roll_no = v.rn
FROM (VALUES
  ('Kamdev', 1), ('Prakash', 2), ('Kuniya Patra', 3), ('Manas Ranjan Nayak', 4),
  ('Bikram', 5), ('Reena', 6), ('Rajikishore Behera', 7), ('Sushanta Ojha', 8),
  ('Rakesh Sahoo', 9), ('Prasanjith Parida', 10), ('Manoj Panda', 11), ('Prasana Panda', 12),
  ('Swapan Mondal', 13), ('Rajesh Mahanty', 14), ('Anjali', 15), ('Bikash Sahoo', 16),
  ('Kedar Barick', 17), ('Ajay', 18), ('Bhabani', 19), ('Uttam', 20),
  ('Mana Sha', 21), ('Bhumika', 22), ('Ramakka', 23), ('Sushanta Barik', 24),
  ('Jagannath', 25), ('Kabita', 26), ('Jajatikeshari Prusty', 27), ('Sankesh Kumar', 28),
  ('Sajal Mandal', 29), ('Akash Kumar', 30), ('Krushna Chandrabal', 31), ('Kumar', 32),
  ('Gyanranjan Swain', 33), ('Ashish Kumar', 34), ('Mazman', 35), ('Ghanasyam', 36),
  ('Sabita Dhar', 37), ('Lipika Sahoo', 38), ('Monu', 39), ('Mampi', 40),
  ('Lija Rani', 41), ('Koyel', 42), ('Sunil', 43), ('Bidulata Patra', 44),
  ('Rajkumar', 45), ('Rajan', 46), ('Bikash', 47), ('Sukanta', 48)
) AS v(name, rn)
WHERE p.full_name = v.name;
