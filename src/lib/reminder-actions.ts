import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const manualReminderSchema = z.object({
  invoiceId: z.string().uuid(),
  stage: z.union([z.literal(3), z.literal(7), z.literal(14)]),
  clientName: z.string().optional(),
  clientEmail: z.string().email().optional(),
  amount: z.number().optional(),
  dueDate: z.string().optional(),
  description: z.string().nullable().optional(),
  userId: z.string().uuid().optional(),
});

export const triggerManualReminder = createServerFn({ method: "POST" })
  .validator((data: unknown) => manualReminderSchema.parse(data))
  .handler(async ({ data }) => {
    const { sendManualInvoiceReminder } = await import("./reminder-runner.server");
    return await sendManualInvoiceReminder(data.invoiceId, data.stage, data);
  });

export const triggerBatchReminders = createServerFn({ method: "POST" }).handler(async () => {
  const { processAllOverdueReminders } = await import("./reminder-runner.server");
  return await processAllOverdueReminders();
});
