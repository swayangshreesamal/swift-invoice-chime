import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { InvoiceCandidate } from "./reminder-runner.server";

const manualReminderSchema = z.object({
  invoiceId: z.string(),
  stage: z.union([z.literal(3), z.literal(7), z.literal(14)]),
  clientName: z.string().optional(),
  client_name: z.string().optional(),
  clientEmail: z.string().optional(),
  client_email: z.string().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  dueDate: z.string().optional(),
  due_date: z.string().optional(),
  description: z.string().nullable().optional(),
  userId: z.string().optional(),
  user_id: z.string().optional(),
  paymentDetails: z.string().nullable().optional(),
  payment_details: z.string().nullable().optional(),
  freelancerName: z.string().nullable().optional(),
  freelancer_name: z.string().nullable().optional(),
});

export const triggerManualReminder = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    // Safely unwrap in case the payload is nested under data
    const candidate =
      raw && typeof raw === "object" && "data" in raw && (raw as any).data
        ? (raw as any).data
        : raw;
    return manualReminderSchema.parse(candidate);
  })
  .handler(async ({ data }) => {
    const { sendManualInvoiceReminder } = await import("./reminder-runner.server");
    return await sendManualInvoiceReminder(data.invoiceId, data.stage, data);
  });

export const triggerBatchReminders = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    if (raw && typeof raw === "object" && "invoices" in raw) {
      return raw as { invoices?: InvoiceCandidate[] };
    }
    return {} as { invoices?: InvoiceCandidate[] };
  })
  .handler(async ({ data }) => {
    const { processAllOverdueReminders } = await import("./reminder-runner.server");
    return await processAllOverdueReminders(data?.invoices);
  });
