-- Prevent replay attacks by ensuring each comment signature can only be used once.
ALTER TABLE comments ADD CONSTRAINT unique_sig UNIQUE (sig);
