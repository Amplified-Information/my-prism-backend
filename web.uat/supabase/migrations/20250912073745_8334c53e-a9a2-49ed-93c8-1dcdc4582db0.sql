-- Relax image_files RLS to allow usage without auth (DEV)
DROP POLICY IF EXISTS "Users can upload images" ON public.image_files;
DROP POLICY IF EXISTS "Users can update their own images" ON public.image_files;
DROP POLICY IF EXISTS "Service role can manage all images" ON public.image_files;

-- Keep public read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='image_files' AND policyname='Public read access to image_files'
  ) THEN
    CREATE POLICY "Public read access to image_files" ON public.image_files FOR SELECT USING (true);
  END IF;
END $$;

-- Allow public insert/update/delete for dev tooling
CREATE POLICY "Public can insert image_files"
ON public.image_files
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can update image_files"
ON public.image_files
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can delete image_files"
ON public.image_files
FOR DELETE
USING (true);
