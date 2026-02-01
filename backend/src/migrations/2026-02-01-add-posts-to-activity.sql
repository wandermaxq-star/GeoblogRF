-- Migration: safely add 'post' variants and rename blog_* visibility columns to post_*
-- Date: 2026-02-01

-- Add 'post' to target_type if missing
DO $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'target_type' AND e.enumlabel = 'post'
  ) THEN
    ALTER TYPE target_type ADD VALUE 'post';
  END IF;
END$$;

-- Add post_created and post_published activity types if missing
DO $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'activity_type' AND e.enumlabel = 'post_created'
  ) THEN
    ALTER TYPE activity_type ADD VALUE 'post_created';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'activity_type' AND e.enumlabel = 'post_published'
  ) THEN
    ALTER TYPE activity_type ADD VALUE 'post_published';
  END IF;
END$$;

-- Add extended post_* activity types (if missing)
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'activity_type' AND e.enumlabel = 'post_updated') THEN
    ALTER TYPE activity_type ADD VALUE 'post_updated';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'activity_type' AND e.enumlabel = 'post_deleted') THEN
    ALTER TYPE activity_type ADD VALUE 'post_deleted';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'activity_type' AND e.enumlabel = 'post_favorited') THEN
    ALTER TYPE activity_type ADD VALUE 'post_favorited';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'activity_type' AND e.enumlabel = 'post_unfavorited') THEN
    ALTER TYPE activity_type ADD VALUE 'post_unfavorited';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'activity_type' AND e.enumlabel = 'post_rated') THEN
    ALTER TYPE activity_type ADD VALUE 'post_rated';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'activity_type' AND e.enumlabel = 'post_commented') THEN
    ALTER TYPE activity_type ADD VALUE 'post_commented';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'activity_type' AND e.enumlabel = 'post_liked') THEN
    ALTER TYPE activity_type ADD VALUE 'post_liked';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'activity_type' AND e.enumlabel = 'post_unliked') THEN
    ALTER TYPE activity_type ADD VALUE 'post_unliked';
  END IF;
END$$;

-- Rename columns in activity_privacy_settings if old names exist
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_privacy_settings' AND column_name = 'blog_created_visibility'
  ) THEN
    ALTER TABLE activity_privacy_settings RENAME COLUMN blog_created_visibility TO post_created_visibility;
  END IF;

  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_privacy_settings' AND column_name = 'blog_published_visibility'
  ) THEN
    ALTER TABLE activity_privacy_settings RENAME COLUMN blog_published_visibility TO post_published_visibility;
  END IF;
END$$;
