-- Add payment_details to invoices and profiles, and full_name to profiles
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS payment_details TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS payment_details TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT;
