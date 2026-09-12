import nodemailer from "nodemailer";

export type ReminderStage = 3 | 7 | 14;

export interface ReminderEmailParams {
  clientName: string;
  clientEmail: string;
  amount: number;
  dueDate: string;
  description?: string | null;
  stage: ReminderStage;
  daysOverdue: number;
  freelancerName?: string | null;
  paymentDetails?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : null;
}

export function renderReminderEmail(params: ReminderEmailParams): RenderedEmail {
  const { clientName, amount, dueDate, description, stage, daysOverdue, freelancerName, paymentDetails } = params;
  const formattedAmount = formatMoney(amount);
  const formattedDue = formatDate(dueDate);
  const payee = freelancerName?.trim() || "Freelancer / Service Provider";
  const paymentInfo =
    paymentDetails?.trim() ||
    "Please reply directly to this email to receive bank remittance or transfer instructions.";

  const directPayUrl = extractFirstUrl(paymentInfo);

  function renderPaymentButton(color: string): string {
    if (!directPayUrl) return "";
    return `
      <div style="margin-top: 14px; text-align: center;">
        <a href="${directPayUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: ${color}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 11px 22px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          Pay Online Now →
        </a>
      </div>
    `;
  }

  if (stage === 3) {
    const subject = `Friendly Reminder: Payment for invoice (${formattedAmount}) is overdue`;
    const text = `Hi ${clientName},

Hope you're having a great week.

This is a gentle reminder that payment of ${formattedAmount} was due on ${formattedDue} (${daysOverdue} days ago).
${description ? `Invoice details: ${description}\n` : ""}
==================================================
HOW TO PAY (SETTLEMENT INSTRUCTIONS):
• Who to pay: ${payee}
• Amount: ${formattedAmount}
• Payment Details:
${paymentInfo}
==================================================

We understand that things get busy and invoices occasionally slip through. If you've already initiated the transfer, please disregard this message.

Otherwise, please remit payment at your earliest convenience or let us know if you need any additional invoice copies.

Thank you,
${payee}
(Sent via PayReminder)`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
  .card { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; }
  .badge { display: inline-block; background: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }
  h2 { margin: 14px 0 10px; font-size: 20px; color: #0f172a; }
  p { font-size: 15px; line-height: 1.6; color: #475569; margin: 10px 0; }
  .details-box { background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 14px 18px; margin: 18px 0; }
  .amount { font-size: 24px; font-weight: bold; color: #0f172a; }
  .payment-highlight { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
  .payment-title { font-size: 12px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
  .payment-row { margin-bottom: 8px; font-size: 14px; color: #14532d; }
  .payment-details-content { margin-top: 6px; padding: 12px 14px; background: #ffffff; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 14px; color: #0f172a; white-space: pre-wrap; word-break: break-word; line-height: 1.5; font-weight: 500; }
  .footer { margin-top: 24px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }
</style></head>
<body>
  <div class="card">
    <span class="badge">Friendly Reminder · 3 Days Overdue</span>
    <h2>Payment Reminder for ${escapeHtml(clientName)}</h2>
    <p>Hi ${escapeHtml(clientName)},</p>
    <p>We hope you're having a productive week! This is a friendly reminder regarding your outstanding invoice.</p>
    <div class="details-box">
      <div>Total Amount Due:</div>
      <div class="amount">${formattedAmount}</div>
      <p style="margin: 6px 0 0; font-size: 13px; color: #64748b;">
        <strong>Due Date:</strong> ${formattedDue} (${daysOverdue} days past due)<br/>
        ${description ? `<strong>Description:</strong> ${escapeHtml(description)}` : ""}
      </p>
    </div>

    <!-- Highlighted Payment Instructions Box -->
    <div class="payment-highlight">
      <div class="payment-title">💳 How &amp; Where to Pay</div>
      <div class="payment-row"><strong>Who to pay:</strong> <span style="font-weight: 700; color: #0f172a;">${escapeHtml(payee)}</span></div>
      <div class="payment-row"><strong>Amount:</strong> <span style="font-weight: 700; color: #0f172a;">${formattedAmount}</span></div>
      <div class="payment-row">
        <strong>Payment Details:</strong>
        <div class="payment-details-content">${escapeHtml(paymentInfo)}</div>
      </div>
      ${renderPaymentButton("#16a34a")}
    </div>

    <p>We know how busy things get. If you have already processed this payment, thank you very much and please feel free to disregard this note.</p>
    <p>If you have any questions or need anything else, please reply directly to this email.</p>
    <div class="footer">
      Sent on behalf of <strong>${escapeHtml(payee)}</strong> via PayReminder.
    </div>
  </div>
</body></html>`;

    return { subject, text, html };
  }

  if (stage === 7) {
    const subject = `Second Notice: Payment of ${formattedAmount} is 7 days past due`;
    const text = `Hi ${clientName},

We are following up on our previous notice regarding your outstanding invoice of ${formattedAmount}, which was due on ${formattedDue} and is now 7 days overdue.
${description ? `Invoice details: ${description}\n` : ""}
==================================================
PAYMENT DETAILS (HOW TO PAY):
• Who to pay: ${payee}
• Outstanding Balance: ${formattedAmount}
• Due Date: ${formattedDue}
• Payment Details:
${paymentInfo}
==================================================

Could you please provide an update on the status of this payment today? Prompt settlement is appreciated.

Thank you,
${payee}
(Sent via PayReminder)`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
  .card { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; }
  .badge { display: inline-block; background: #fef3c7; color: #b45309; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }
  h2 { margin: 14px 0 10px; font-size: 20px; color: #0f172a; }
  p { font-size: 15px; line-height: 1.6; color: #475569; margin: 10px 0; }
  .details-box { background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 14px 18px; margin: 18px 0; }
  .amount { font-size: 24px; font-weight: bold; color: #0f172a; }
  .payment-highlight { background: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
  .payment-title { font-size: 12px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
  .payment-row { margin-bottom: 8px; font-size: 14px; color: #78350f; }
  .payment-details-content { margin-top: 6px; padding: 12px 14px; background: #ffffff; border: 1px solid #fde68a; border-radius: 6px; font-size: 14px; color: #0f172a; white-space: pre-wrap; word-break: break-word; line-height: 1.5; font-weight: 500; }
  .footer { margin-top: 24px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }
</style></head>
<body>
  <div class="card">
    <span class="badge">Second Notice · 7 Days Overdue</span>
    <h2>Follow-up: Overdue Invoice for ${escapeHtml(clientName)}</h2>
    <p>Hi ${escapeHtml(clientName)},</p>
    <p>We are following up on our previous notice regarding your outstanding balance. Our records show that we have not yet received payment for this invoice.</p>
    <div class="details-box">
      <div>Outstanding Balance:</div>
      <div class="amount">${formattedAmount}</div>
      <p style="margin: 6px 0 0; font-size: 13px; color: #78350f;">
        <strong>Due Date:</strong> ${formattedDue} (${daysOverdue} days past due)<br/>
        ${description ? `<strong>Description:</strong> ${escapeHtml(description)}` : ""}
      </p>
    </div>

    <!-- Highlighted Payment Instructions Box -->
    <div class="payment-highlight">
      <div class="payment-title">💳 How &amp; Where to Pay</div>
      <div class="payment-row"><strong>Who to pay:</strong> <span style="font-weight: 700; color: #0f172a;">${escapeHtml(payee)}</span></div>
      <div class="payment-row"><strong>Amount Due:</strong> <span style="font-weight: 700; color: #0f172a;">${formattedAmount}</span></div>
      <div class="payment-row">
        <strong>Payment Details:</strong>
        <div class="payment-details-content">${escapeHtml(paymentInfo)}</div>
      </div>
      ${renderPaymentButton("#d97706")}
    </div>

    <p>Could you please look into this today and confirm when we can expect the remittance?</p>
    <p>If you have already sent payment, please reply with the transaction reference so records can be updated.</p>
    <div class="footer">
      Sent on behalf of <strong>${escapeHtml(payee)}</strong> via PayReminder.
    </div>
  </div>
</body></html>`;

    return { subject, text, html };
  }

  // Stage 14: Final Notice
  const subject = `FINAL NOTICE: Immediate payment required for invoice (${formattedAmount})`;
  const text = `Hi ${clientName},

This is an urgent and final notice regarding your overdue invoice of ${formattedAmount}, originally due on ${formattedDue} (${daysOverdue} days past due).
${description ? `Invoice details: ${description}\n` : ""}
==================================================
IMMEDIATE SETTLEMENT REQUIRED (HOW TO PAY):
• Who to pay: ${payee}
• Total Outstanding: ${formattedAmount}
• Original Due Date: ${formattedDue}
• Payment Details:
${paymentInfo}
==================================================

Despite multiple previous reminders, this account remains unsettled. Please remit payment immediately using the details above or contact ${payee} today to resolve this matter.

Sincerely,
${payee}
(Sent via PayReminder)`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
  .card { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #fecaca; border-radius: 12px; padding: 28px; }
  .badge { display: inline-block; background: #fee2e2; color: #b91c1c; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }
  h2 { margin: 14px 0 10px; font-size: 20px; color: #991b1b; }
  p { font-size: 15px; line-height: 1.6; color: #475569; margin: 10px 0; }
  .details-box { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px 18px; margin: 18px 0; }
  .amount { font-size: 24px; font-weight: bold; color: #991b1b; }
  .payment-highlight { background: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
  .payment-title { font-size: 12px; font-weight: 700; color: #b91c1c; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
  .payment-row { margin-bottom: 8px; font-size: 14px; color: #991b1b; }
  .payment-details-content { margin-top: 6px; padding: 12px 14px; background: #ffffff; border: 1px solid #fecaca; border-radius: 6px; font-size: 14px; color: #0f172a; white-space: pre-wrap; word-break: break-word; line-height: 1.5; font-weight: 600; }
  .footer { margin-top: 24px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }
</style></head>
<body>
  <div class="card">
    <span class="badge">Final Notice · 14 Days Overdue</span>
    <h2>Urgent Payment Required: ${escapeHtml(clientName)}</h2>
    <p>Hi ${escapeHtml(clientName)},</p>
    <p>This is an urgent and final notice regarding your account balance, which is now significantly past due.</p>
    <div class="details-box">
      <div>Total Outstanding:</div>
      <div class="amount">${formattedAmount}</div>
      <p style="margin: 6px 0 0; font-size: 13px; color: #991b1b;">
        <strong>Original Due Date:</strong> ${formattedDue} (${daysOverdue} days past due)<br/>
        ${description ? `<strong>Description:</strong> ${escapeHtml(description)}` : ""}
      </p>
    </div>

    <!-- Highlighted Payment Instructions Box -->
    <div class="payment-highlight">
      <div class="payment-title">🚨 Immediate Settlement Instructions</div>
      <div class="payment-row"><strong>Who to pay:</strong> <span style="font-weight: 700; color: #0f172a;">${escapeHtml(payee)}</span></div>
      <div class="payment-row"><strong>Total Overdue:</strong> <span style="font-weight: 700; color: #0f172a;">${formattedAmount}</span></div>
      <div class="payment-row">
        <strong>Remittance Account / Details:</strong>
        <div class="payment-details-content">${escapeHtml(paymentInfo)}</div>
      </div>
      ${renderPaymentButton("#dc2626")}
    </div>

    <p>Please remit payment immediately to settle this account. If there is an unresolved question regarding this invoice, please reach out to <strong>${escapeHtml(payee)}</strong> today.</p>
    <div class="footer">
      Sent on behalf of <strong>${escapeHtml(payee)}</strong> via PayReminder.
    </div>
  </div>
</body></html>`;

  return { subject, text, html };
}

export function getMailTransporter(): nodemailer.Transporter {
  const user = process.env["SMTP_USER"] || "payreminder.help@gmail.com";
  // Fallback to validated 16-character App Password if env var is not set in deployment
  const rawPass = process.env["SMTP_PASS"] || "vwhplkpdmdadyyko";
  const pass = rawPass.replace(/\s+/g, "");

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: true,
    },
  });
}

export async function sendReminderEmail(
  params: ReminderEmailParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = getMailTransporter();
    const { subject, html, text } = renderReminderEmail(params);
    const fromAddress = process.env["SMTP_USER"] || "payreminder.help@gmail.com";

    console.log(
      `[EmailService] Attempting to deliver stage ${params.stage} notice to ${params.clientEmail} via ${fromAddress}...`,
    );

    const info = await transporter.sendMail({
      from: `"PayReminder" <${fromAddress}>`,
      to: params.clientEmail,
      replyTo: fromAddress,
      subject,
      text,
      html,
    });

    console.log(
      `[EmailService] Dispatched successfully! MessageId: ${info.messageId}, Response: ${info.response}`,
    );

    return { success: true, messageId: info.messageId };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[EmailService Error]:", errorMsg);
    return { success: false, error: errorMsg };
  }
}
