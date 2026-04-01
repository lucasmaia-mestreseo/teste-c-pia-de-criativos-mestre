ALTER TABLE public.generated_creatives ADD COLUMN favorite boolean NOT NULL DEFAULT false;

CREATE POLICY "Approved users can update generated_creatives"
ON public.generated_creatives
FOR UPDATE
TO authenticated
USING (is_approved(auth.uid()));
