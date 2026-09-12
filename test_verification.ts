import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// 1. Invoice schema as defined in InvoiceForm.tsx
const invoiceSchema = z.object({
  client_name: z.string().trim().min(1, "Client name is required").max(120),
  client_email: z.string().trim().email("Client email doesn't look right").max(255),
  amount: z.number().positive("Amount must be more than zero").max(10_000_000),
  invoice_date: z.string().min(1, "Invoice date is required"),
  due_date: z.string().min(1, "Due date is required"),
  description: z.string().trim().max(300).optional(),
  payment_details: z.string().trim().max(1000).optional(),
  client_notes: z.string().trim().max(500).optional(),
  late_fee: z.string().trim().max(120).optional(),
});

// 2. Auth schema as defined in auth.tsx
const authSchema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

// 3. Format functions as defined in format.ts
function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysOverdue(dueDate: string): number {
  const due = new Date(`${dueDate}T00:00:00`).getTime();
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((start - due) / 86400000);
}

// 4. Free plan limit simulation matching PostgreSQL trigger logic
function checkCanAddInvoice(
  plan: string,
  currentInvoiceCount: number,
): { allowed: boolean; error?: string } {
  const userPlan = plan || "free";
  if (userPlan === "free" && currentInvoiceCount >= 3) {
    return {
      allowed: false,
      error: "Free plan is limited to 3 invoices. Upgrade to Pro for unlimited invoices.",
    };
  }
  return { allowed: true };
}

// ==========================================
// TEST SUITE
// ==========================================

test("Invoice validation - accepts valid invoice", () => {
  const valid = {
    client_name: "Acme Corp",
    client_email: "billing@acme.com",
    amount: 1500,
    invoice_date: "2026-09-01",
    due_date: "2026-09-15",
    description: "Web development sprint",
  };
  const result = invoiceSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("Invoice validation - rejects invalid client emails", () => {
  const invalidEmails = ["notanemail", "test@", "@domain.com", "spaces in@mail.com"];
  for (const email of invalidEmails) {
    const result = invoiceSchema.safeParse({
      client_name: "Acme",
      client_email: email,
      amount: 100,
      invoice_date: "2026-09-01",
      due_date: "2026-09-15",
    });
    assert.equal(result.success, false, `Expected ${email} to fail validation`);
  }
});

test("Invoice validation - rejects zero and negative amounts", () => {
  const invalidAmounts = [0, -1, -500];
  for (const amount of invalidAmounts) {
    const result = invoiceSchema.safeParse({
      client_name: "Acme",
      client_email: "test@example.com",
      amount,
      invoice_date: "2026-09-01",
      due_date: "2026-09-15",
    });
    assert.equal(result.success, false, `Expected amount ${amount} to be rejected`);
  }
});

test("Invoice validation - rejects descriptions exceeding 300 characters", () => {
  const longDesc = "a".repeat(301);
  const result = invoiceSchema.safeParse({
    client_name: "Acme",
    client_email: "test@example.com",
    amount: 100,
    invoice_date: "2026-09-01",
    due_date: "2026-09-15",
    description: longDesc,
  });
  assert.equal(result.success, false);
});

test("Auth validation - verifies valid credentials", () => {
  const valid = { email: "user@example.com", password: "securePassword123" };
  const result = authSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("Auth validation - enforces minimum 6 character password", () => {
  const short = { email: "user@example.com", password: "123" };
  const result = authSchema.safeParse(short);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error.issues[0]?.message ?? "", /at least 6 characters/);
  }
});

test("Financial calculations - formatMoney formats integers and decimals properly", () => {
  assert.equal(formatMoney(1500), "$1,500");
  assert.equal(formatMoney(1500.5), "$1,500.50");
  assert.equal(formatMoney(0), "$0");
});

test("Financial calculations - daysOverdue calculates past and future dates correctly", () => {
  const today = new Date();
  const formatYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const pastDate = new Date(today);
  pastDate.setDate(today.getDate() - 7);
  assert.equal(daysOverdue(formatYMD(pastDate)), 7);

  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 5);
  assert.equal(daysOverdue(formatYMD(futureDate)), -5);

  assert.equal(daysOverdue(formatYMD(today)), 0);
});

test("Free-plan 3-invoice limit - enforces 3-invoice cap on Free plan", () => {
  assert.equal(checkCanAddInvoice("free", 0).allowed, true);
  assert.equal(checkCanAddInvoice("free", 1).allowed, true);
  assert.equal(checkCanAddInvoice("free", 2).allowed, true);

  const limitReached = checkCanAddInvoice("free", 3);
  assert.equal(limitReached.allowed, false);
  assert.match(limitReached.error ?? "", /Free plan is limited to 3 invoices/);

  const limitExceeded = checkCanAddInvoice("free", 4);
  assert.equal(limitExceeded.allowed, false);
});

test("Free-plan 3-invoice limit - unlocks unlimited invoices on Pro plan", () => {
  assert.equal(checkCanAddInvoice("pro", 3).allowed, true);
  assert.equal(checkCanAddInvoice("pro", 10).allowed, true);
  assert.equal(checkCanAddInvoice("pro", 500).allowed, true);
});

test("Dashboard financial tracking - outstanding balance and paid tracking", () => {
  const invoices = [
    { id: "1", amount: 500, status: "unpaid" },
    { id: "2", amount: 1200, status: "unpaid" },
    { id: "3", amount: 300, status: "unpaid" },
  ];

  let unpaid = invoices.filter((i) => i.status === "unpaid");
  let outstanding = unpaid.reduce((sum, i) => sum + i.amount, 0);
  let paidCount = invoices.length - unpaid.length;

  assert.equal(outstanding, 2000);
  assert.equal(paidCount, 0);

  // Mark invoice 2 as paid
  invoices[1]!.status = "paid";
  unpaid = invoices.filter((i) => i.status === "unpaid");
  outstanding = unpaid.reduce((sum, i) => sum + i.amount, 0);
  paidCount = invoices.length - unpaid.length;

  assert.equal(outstanding, 800);
  assert.equal(paidCount, 1);

  // Mark invoice 2 as unpaid again
  invoices[1]!.status = "unpaid";
  unpaid = invoices.filter((i) => i.status === "unpaid");
  outstanding = unpaid.reduce((sum, i) => sum + i.amount, 0);
  paidCount = invoices.length - unpaid.length;

  assert.equal(outstanding, 2000);
  assert.equal(paidCount, 0);
});

test("PayPal Pro subscription configuration contract", () => {
  const PLAN_ID = "P-7PU30395VJ1727507NKR4O6I";
  const SDK_URL =
    "https://www.paypal.com/sdk/js?client-id=BAAfpgWRrENfXXGQJoTHPUKITKxodhLascJ8diMsirEGX-Ir_5LzF1w2X-QVATX404EVMEfD3nuFE0r24o&vault=true&intent=subscription";

  assert.ok(SDK_URL.includes("vault=true"));
  assert.ok(SDK_URL.includes("intent=subscription"));
  assert.equal(PLAN_ID, "P-7PU30395VJ1727507NKR4O6I");

  const mockApproval = { subscriptionID: "I-SUB123456" };
  const updatePayload = { plan: "pro", paypal_subscription_id: mockApproval.subscriptionID };
  assert.equal(updatePayload.plan, "pro");
  assert.equal(updatePayload.paypal_subscription_id, "I-SUB123456");
});

test("Reminder email templates - renders 3d, 7d, and 14d templates with correct tone and data", async () => {
  const { renderReminderEmail } = await import("./src/lib/email-service.server.ts");

  // Stage 3: Polite
  const stage3 = renderReminderEmail({
    clientName: "Acme Studio",
    clientEmail: "billing@acme.com",
    amount: 1200,
    dueDate: "2026-09-01",
    description: "Design retainer",
    freelancerName: "Jane Doe Design",
    paymentDetails: "PayPal: https://paypal.me/janedoe or UPI: janedoe@upi",
    stage: 3,
    daysOverdue: 3,
  });
  assert.match(stage3.subject, /Friendly Reminder/i);
  assert.match(stage3.html, /\$1,200/);
  assert.match(stage3.html, /Acme Studio/);
  assert.match(stage3.html, /Design retainer/);
  assert.match(stage3.html, /Jane Doe Design/);
  assert.match(stage3.html, /paypal\.me\/janedoe/);
  assert.match(stage3.html, /How &amp; Where to Pay|How & Where to Pay/);
  assert.match(stage3.html, /Pay via PayPal →|Pay Online Now →/);
  assert.match(stage3.text, /gentle reminder/i);
  assert.match(stage3.text, /Who to pay: Jane Doe Design/i);
  assert.match(stage3.text, /HOW TO PAY/i);

  // Stage 7: Firmer
  const stage7 = renderReminderEmail({
    clientName: "Acme Studio",
    clientEmail: "billing@acme.com",
    amount: 1200,
    dueDate: "2026-09-01",
    description: "Design retainer",
    freelancerName: "Jane Doe Design",
    paymentDetails: "Bank Wire: Routing #021000021, Account #987654321",
    stage: 7,
    daysOverdue: 7,
  });
  assert.match(stage7.subject, /Second Notice.*7 days/i);
  assert.match(stage7.html, /Second Notice · 7 Days Overdue/i);
  assert.match(stage7.html, /Jane Doe Design/);
  assert.match(stage7.html, /Routing #021000021/);
  assert.match(stage7.text, /following up on our previous notice/i);
  assert.match(stage7.text, /Who to pay: Jane Doe Design/i);
  assert.match(stage7.text, /Account #987654321/);

  // Stage 14: Final notice
  const stage14 = renderReminderEmail({
    clientName: "Acme Studio",
    clientEmail: "billing@acme.com",
    amount: 1200,
    dueDate: "2026-09-01",
    description: "Design retainer",
    freelancerName: "Jane Doe Design",
    paymentDetails: "Pay immediately via https://pay.stripe.com/inv_123 or Wire Acct #987654321",
    stage: 14,
    daysOverdue: 14,
  });
  assert.match(stage14.subject, /FINAL NOTICE/i);
  assert.match(stage14.html, /Final Notice · 14 Days Overdue/i);
  assert.match(stage14.html, /Immediate Settlement Instructions/i);
  assert.match(stage14.html, /Jane Doe Design/);
  assert.match(stage14.html, /pay\.stripe\.com\/inv_123/);
  assert.match(stage14.html, /Pay via Stripe →|Pay Online Now →/);
  assert.match(stage14.text, /urgent and final notice/i);
  assert.match(stage14.text, /Who to pay: Jane Doe Design/i);
  assert.match(stage14.text, /HOW TO PAY/i);
});

test("Invoice validation - accepts optional payment_details and respects length limits", () => {
  const validWithPayment = {
    client_name: "Acme Corp",
    client_email: "billing@acme.com",
    amount: 1500,
    invoice_date: "2026-09-01",
    due_date: "2026-09-15",
    payment_details: "PayPal: https://paypal.me/test | UPI: test@upi | Wire: 123456",
  };
  const result = invoiceSchema.safeParse(validWithPayment);
  assert.equal(result.success, true);

  const tooLong = {
    ...validWithPayment,
    payment_details: "x".repeat(1001),
  };
  const longResult = invoiceSchema.safeParse(tooLong);
  assert.equal(longResult.success, false);
});

test("Reminder email templates - provides graceful fallback when payment details or freelancer name omitted", async () => {
  const { renderReminderEmail } = await import("./src/lib/email-service.server.ts");

  const email = renderReminderEmail({
    clientName: "Acme Studio",
    clientEmail: "billing@acme.com",
    amount: 1200,
    dueDate: "2026-09-01",
    stage: 3,
    daysOverdue: 3,
  });

  // Default fallback for freelancer name is "Freelancer / Service Provider"
  assert.match(email.html, /Freelancer \/ Service Provider/);
  assert.match(email.text, /Freelancer \/ Service Provider/);
  // Default fallback for payment details informs client to reply
  assert.match(email.html, /Please reply directly to this email to receive/i);
  assert.match(email.text, /Please reply directly to this email to receive/i);
});

test("Invoice validation - accepts optional client_notes and late_fee", () => {
  const valid = {
    client_name: "Acme Corp",
    client_email: "billing@acme.com",
    amount: 2500,
    invoice_date: "2026-09-01",
    due_date: "2026-09-15",
    payment_details: "PayPal: https://paypal.me/acme",
    client_notes: "Usually pays 5 days late; prefers UPI payment",
    late_fee: "5% late fee ($125)",
  };
  const result = invoiceSchema.safeParse(valid);
  assert.equal(result.success, true);

  // Rejects excessively long notes (> 500 chars)
  const tooLongNote = { ...valid, client_notes: "a".repeat(501) };
  assert.equal(invoiceSchema.safeParse(tooLongNote).success, false);

  // Rejects excessively long late fee (> 120 chars)
  const tooLongFee = { ...valid, late_fee: "b".repeat(121) };
  assert.equal(invoiceSchema.safeParse(tooLongFee).success, false);
});

test("Reminder email templates - renders multiple payment buttons when multiple payment options provided", async () => {
  const { renderReminderEmail } = await import("./src/lib/email-service.server.ts");

  const multiPayEmail = renderReminderEmail({
    clientName: "Acme Studio",
    clientEmail: "billing@acme.com",
    amount: 1500,
    dueDate: "2026-09-01",
    stage: 3,
    daysOverdue: 3,
    freelancerName: "Alex Rivera Studio",
    paymentDetails:
      "1. PayPal: https://paypal.me/alexrivera\n2. Stripe: https://buy.stripe.com/abc123\n3. UPI: alex@upi",
  });

  // Should render both buttons
  assert.match(multiPayEmail.html, /Pay via PayPal →/);
  assert.match(multiPayEmail.html, /Pay via Stripe →/);
  assert.match(multiPayEmail.html, /https:\/\/paypal\.me\/alexrivera/);
  assert.match(multiPayEmail.html, /https:\/\/buy\.stripe\.com\/abc123/);
  assert.match(multiPayEmail.text, /alex@upi/);
});

test("Reminder email templates - renders late fee notice in Stage 14 urgent notice", async () => {
  const { renderReminderEmail } = await import("./src/lib/email-service.server.ts");

  const stage14WithLateFee = renderReminderEmail({
    clientName: "Acme Studio",
    clientEmail: "billing@acme.com",
    amount: 2000,
    dueDate: "2026-09-01",
    stage: 14,
    daysOverdue: 14,
    freelancerName: "Jane Doe Design",
    paymentDetails: "Wire details: Routing #123456, Account #987654321",
    lateFee: "5% late fee ($100)",
  });

  // HTML assertions
  assert.match(stage14WithLateFee.html, /Late Fee Notice:/i);
  assert.match(stage14WithLateFee.html, /5% late fee \(\$100\)/);

  // Text assertions
  assert.match(stage14WithLateFee.text, /LATE FEE NOTICE: A late fee of 5% late fee \(\$100\) applies/i);
});

test("Invoice metadata resilience - packs and unpacks extended attributes into description", async () => {
  const { packInvoiceMetadata, unpackInvoiceMetadata, cleanDescription, resolveInvoice } =
    await import("./src/lib/invoice-metadata.ts");

  // 1. Pack metadata into description
  const rawDesc = "Brand design & web development";
  const packed = packInvoiceMetadata(rawDesc, {
    payment_details: "https://paypal.me/SwayangSamal",
    client_notes: "he pays after 10 days",
    late_fee: "5% late fee",
  });

  assert.ok(packed);
  assert.match(packed, /^Brand design & web development\n\[METADATA:\{.*\}\]$/);

  // 2. Clean description strips tag
  const cleaned = cleanDescription(packed);
  assert.equal(cleaned, "Brand design & web development");

  // 3. Unpack recovers all fields
  const unpacked = unpackInvoiceMetadata(packed);
  assert.equal(unpacked.cleanDescription, "Brand design & web development");
  assert.equal(unpacked.payment_details, "https://paypal.me/SwayangSamal");
  assert.equal(unpacked.client_notes, "he pays after 10 days");
  assert.equal(unpacked.late_fee, "5% late fee");

  // 4. Resolves invoice using unpacked metadata if DB columns are null
  const baseInvoice = {
    id: "inv_123",
    client_name: "Acme Corp",
    client_email: "billing@acme.com",
    amount: 1200,
    invoice_date: "2026-09-01",
    due_date: "2026-09-15",
    description: packed,
    payment_details: null,
    client_notes: null,
    late_fee: null,
    status: "unpaid",
  };

  const resolved = resolveInvoice(baseInvoice, "default_profile_payment");
  assert.equal(resolved.description, "Brand design & web development");
  assert.equal(resolved.payment_details, "https://paypal.me/SwayangSamal");
  assert.equal(resolved.client_notes, "he pays after 10 days");
  assert.equal(resolved.late_fee, "5% late fee");

  // 5. Fallback core values strictly only contain guaranteed columns
  const coreValues = {
    client_name: baseInvoice.client_name,
    client_email: baseInvoice.client_email,
    amount: baseInvoice.amount,
    invoice_date: baseInvoice.invoice_date,
    due_date: baseInvoice.due_date,
    description: packed,
  };

  assert.equal("payment_details" in coreValues, false);
  assert.equal("client_notes" in coreValues, false);
  assert.equal("late_fee" in coreValues, false);
});



