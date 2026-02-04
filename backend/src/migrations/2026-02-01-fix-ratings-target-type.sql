-- Migration: update ratings.target_type CHECK to include 'post'
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'ratings' AND tc.constraint_type = 'CHECK' AND tc.constraint_name = 'ratings_target_type_check'
  ) THEN
    ALTER TABLE ratings DROP CONSTRAINT ratings_target_type_check;
  END IF;

  -- Add new constraint
  ALTER TABLE ratings
  ADD CONSTRAINT ratings_target_type_check CHECK (target_type IN ('marker','route','event','post'));
EXCEPTION WHEN undefined_table THEN
  -- Table doesn't exist yet; ignore
  RAISE NOTICE 'ratings table not present, skipping constraint change';
END$$;
