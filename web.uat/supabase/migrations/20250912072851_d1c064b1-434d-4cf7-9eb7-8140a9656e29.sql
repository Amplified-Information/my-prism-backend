-- Create image_files table for storing image metadata
CREATE TABLE public.image_files (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    alt_text TEXT,
    keywords TEXT[], -- Array of keywords for search
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.image_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for image_files
CREATE POLICY "Public read access to image_files" 
ON public.image_files 
FOR SELECT 
USING (true);

CREATE POLICY "Users can upload images" 
ON public.image_files 
FOR INSERT 
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their own images" 
ON public.image_files 
FOR UPDATE 
USING (auth.uid() = uploaded_by);

CREATE POLICY "Service role can manage all images" 
ON public.image_files 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create GIN index for keywords array search
CREATE INDEX idx_image_files_keywords ON public.image_files USING GIN(keywords);

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_image_files_updated_at
    BEFORE UPDATE ON public.image_files
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true);

-- Create storage policies for images bucket
CREATE POLICY "Public can view images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'images');

CREATE POLICY "Authenticated users can upload images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);