-- Drop the existing restrictive storage policies
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- Create more permissive storage policies for public uploads
CREATE POLICY "Anyone can upload images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'images');

CREATE POLICY "Anyone can update images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'images');

CREATE POLICY "Anyone can delete images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'images');