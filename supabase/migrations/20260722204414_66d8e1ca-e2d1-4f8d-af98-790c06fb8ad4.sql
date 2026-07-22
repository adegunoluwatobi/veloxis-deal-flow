
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_manager';
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'deed_sent';
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'deed_acknowledged';
ALTER TYPE public.deal_document_type ADD VALUE IF NOT EXISTS 'deed_of_assignment';
ALTER TYPE public.deal_document_type ADD VALUE IF NOT EXISTS 'notice_of_assignment';
ALTER TYPE public.deal_document_type ADD VALUE IF NOT EXISTS 'buyer_confirmation';
ALTER TYPE public.deal_document_type ADD VALUE IF NOT EXISTS 'disbursement_proof';
ALTER TYPE public.deal_document_type ADD VALUE IF NOT EXISTS 'repayment_proof';
