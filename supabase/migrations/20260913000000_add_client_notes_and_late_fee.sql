-- Add client_notes and late_fee to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_notes TEXT,
  ADD COLUMN IF NOT EXISTS late_fee TEXT;

COMMENT ON COLUMN public.invoices.client_notes IS 'Private internal notes about this client, visible only to the freelancer (e.g. Prefers UPI, Usually pays late).';
COMMENT ON COLUMN public.invoices.late_fee IS 'Optional late fee policy or amount mentioned in the 14-day final notice (e.g. 5% late fee or $50 overdue fee).';
