-- Allow authenticated users to record sent reminders for their own invoices
GRANT INSERT, UPDATE, DELETE ON public.reminders TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reminders' AND policyname = 'reminders_insert_own'
  ) THEN
    CREATE POLICY "reminders_insert_own" ON public.reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reminders' AND policyname = 'reminders_update_own'
  ) THEN
    CREATE POLICY "reminders_update_own" ON public.reminders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
