
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Anyone can create projects" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update projects" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete projects" ON public.projects FOR DELETE USING (true);
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Brand kits table
CREATE TABLE public.brand_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  colors TEXT[] DEFAULT '{}',
  typography TEXT,
  logo_url TEXT,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view brand_kits" ON public.brand_kits FOR SELECT USING (true);
CREATE POLICY "Anyone can create brand_kits" ON public.brand_kits FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update brand_kits" ON public.brand_kits FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete brand_kits" ON public.brand_kits FOR DELETE USING (true);
CREATE TRIGGER update_brand_kits_updated_at BEFORE UPDATE ON public.brand_kits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Swipe files table
CREATE TABLE public.swipe_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  name TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.swipe_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view swipe_files" ON public.swipe_files FOR SELECT USING (true);
CREATE POLICY "Anyone can create swipe_files" ON public.swipe_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete swipe_files" ON public.swipe_files FOR DELETE USING (true);

-- Generated creatives table
CREATE TABLE public.generated_creatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  swipe_file_id UUID REFERENCES public.swipe_files(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('9:16', '4:5', '1:1', '16:9')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view generated_creatives" ON public.generated_creatives FOR SELECT USING (true);
CREATE POLICY "Anyone can create generated_creatives" ON public.generated_creatives FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete generated_creatives" ON public.generated_creatives FOR DELETE USING (true);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('swipe-files', 'swipe-files', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-creatives', 'generated-creatives', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-photos', 'brand-photos', true);

-- Storage policies
CREATE POLICY "Public read logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Anyone can upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Anyone can delete logos" ON storage.objects FOR DELETE USING (bucket_id = 'logos');

CREATE POLICY "Public read swipe-files" ON storage.objects FOR SELECT USING (bucket_id = 'swipe-files');
CREATE POLICY "Anyone can upload swipe-files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'swipe-files');
CREATE POLICY "Anyone can delete swipe-files" ON storage.objects FOR DELETE USING (bucket_id = 'swipe-files');

CREATE POLICY "Public read generated-creatives" ON storage.objects FOR SELECT USING (bucket_id = 'generated-creatives');
CREATE POLICY "Anyone can upload generated-creatives" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'generated-creatives');
CREATE POLICY "Anyone can delete generated-creatives" ON storage.objects FOR DELETE USING (bucket_id = 'generated-creatives');

CREATE POLICY "Public read brand-photos" ON storage.objects FOR SELECT USING (bucket_id = 'brand-photos');
CREATE POLICY "Anyone can upload brand-photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'brand-photos');
CREATE POLICY "Anyone can delete brand-photos" ON storage.objects FOR DELETE USING (bucket_id = 'brand-photos');
