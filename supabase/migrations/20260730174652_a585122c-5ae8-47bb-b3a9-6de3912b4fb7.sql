ALTER TABLE public.v2_exporter_directors
  ADD COLUMN IF NOT EXISTS id_document_url text,
  ADD COLUMN IF NOT EXISTS id_document_name text;