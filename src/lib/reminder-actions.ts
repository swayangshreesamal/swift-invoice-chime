import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const manualReminderSchema = z.object({
  invoiceId: z.string().uuid(),
  stage: z.union([z.literal(3), z.literal(7), z.literal(14)]),
});

export const triggerManualReminder = createServerFn({ method: "POST" })
  .validator((data: unknown) => manualReminderSchema.parse(data))
  .handler(async ({ data }) => {
    const { sendManualInvoiceReminder } = await import("./reminder-runner.server");
    return await sendManualInvoiceReminder(data.invoiceId, data.stage);
  });

export const triggerBatchReminders = createServerFn({ method: "POST" }).handler(async () => {
  const { processAllOverdueReminders } = await import("./reminder-runner.server");
  return await processAllOverdueReminders();
});
