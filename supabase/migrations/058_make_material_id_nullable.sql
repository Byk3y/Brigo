-- Migration: Make material_id nullable on notebooks table
-- Purpose: Enable multi-source notebooks without requiring a "primary" material
-- Safe: Backward compatible - existing notebooks retain their material_id values
-- 
-- Background:
-- Originally, notebooks had a 1:1 relationship with materials via material_id.
-- Now, materials link to notebooks via materials.notebook_id (1:many).
-- This migration removes the NOT NULL constraint to allow notebooks to be created
-- without a "primary" material, supporting features like "Discover Sources" where
-- multiple web sources are imported simultaneously.

-- Step 1: Drop the NOT NULL constraint on material_id
-- Note: The foreign key constraint remains - if a material_id IS set, it must be valid
ALTER TABLE notebooks 
ALTER COLUMN material_id DROP NOT NULL;

-- Step 2: Add a comment explaining the column's new optional status
COMMENT ON COLUMN notebooks.material_id IS 
  'Legacy: The original "primary" material. Now optional for multi-source notebooks. '
  'For new multi-source notebooks, this can be NULL. '
  'Query materials table via notebook_id to get all sources for a notebook.';

-- Step 3: Create an index to help with querying notebooks without material_id
-- (Useful for finding multi-source notebooks or debugging)
CREATE INDEX IF NOT EXISTS idx_notebooks_material_id_null 
ON notebooks (id) 
WHERE material_id IS NULL;
