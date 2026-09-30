-- generated_creatives.format only accepted 9:16, 4:5, 1:1 and 16:9, so pieces in
-- new formats (1200x628 = "1.91:1", or any format an admin adds in Admin → Formatos)
-- were generated and then rejected when saved. Accept any "W:H" ratio instead.
ALTER TABLE public.generated_creatives DROP CONSTRAINT IF EXISTS generated_creatives_format_check;
ALTER TABLE public.generated_creatives
  ADD CONSTRAINT generated_creatives_format_check
  CHECK (format ~ '^[0-9]+(\.[0-9]+)?:[0-9]+(\.[0-9]+)?$');
