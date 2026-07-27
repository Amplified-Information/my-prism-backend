-- Deduplicate existing rows: keep the earliest comment per sig, append a random suffix to the rest.
WITH duplicates AS (
  SELECT comment_id,
         ROW_NUMBER() OVER (PARTITION BY sig ORDER BY comment_id) AS rn
  FROM comments
)
UPDATE comments
SET sig = sig || '_dup_' || gen_random_uuid()::text
WHERE comment_id IN (
  SELECT comment_id FROM duplicates WHERE rn > 1
);

-- Prevent replay attacks by ensuring each comment signature can only be used once.
ALTER TABLE comments ADD CONSTRAINT unique_sig UNIQUE (sig);
