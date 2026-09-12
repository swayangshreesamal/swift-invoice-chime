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

export function renderReminderEmail(params: ReminderEmailParams): RenderedEmail {
  const { clientName, amount, dueDate, description, stage, daysOverdue } = params;
  const formattedAmount = formatMoney(amount);
  const formattedDue = formatDate(dueDate);

  if (stage === 3) {
    const subject = `Friendly Reminder: Payment for invoice (${formattedAmount}) is overdue`;
    const text = `Hi ${clientName},

Hope you're having a great week.

This is a gentle reminder that payment of ${formattedAmount} was due on ${formattedDue} (${daysOverdue} days ago).
${description ? `Invoice details: ${description}\n` : ""}
We understand that things can get busy and payments occasionally slip through. If you've already initiated the transfer, please disregard this message.

Otherwise, please arrange payment at your earliest convenience or let us know if you need any additional invoice copies.

Thank you,
PayReminder System`;

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
  .footer { margin-top: 24px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }
</style></head>
<body>
  <div class="card">
    <span class="badge">Friendly Reminder · 3 Days Overdue</span>
    <h2>Payment Reminder for ${clientName}</h2>
    <p>Hi ${clientName},</p>
    <p>We hope you're having a productive week! This is a friendly reminder regarding your outstanding invoice.</p>
    <div class="details-box">
      <div>Total Amount Due:</div>
      <div class="amount">${formattedAmount}</div>
      <p style="margin: 6px 0 0; font-size: 13px; color: #64748b;">
        <strong>Due Date:</strong> ${formattedDue} (${daysOverdue} days past due)<br/>
        ${description ? `<strong>Description:</strong> ${description}` : ""}
      </p>
    </div>
    <p>We know how busy things get. If you have already processed this payment, thank you very much and please feel free to disregard this note.</p>
    <p>If you have any questions or need payment details re-sent, please reach out.</p>
    <div class="footer">
      Sent via PayReminder · Helping freelancers and small businesses get paid on time.
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
Could you please provide an update on the status of this payment, or let us know if there are any issues we can assist with?

Prompt settlement is appreciated.

Thank you,
PayReminder System`;

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
  .footer { margin-top: 24px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }
</style></head>
<body>
  <div class="card">
    <span class="badge">Second Notice · 7 Days Overdue</span>
    <h2>Follow-up: Overdue Invoice for ${clientName}</h2>
    <p>Hi ${clientName},</p>
    <p>We are following up on our previous notice regarding your outstanding balance. Our records show that we have not yet received payment for this invoice.</p>
    <div class="details-box">
      <div>Outstanding Balance:</div>
      <div class="amount">${formattedAmount}</div>
      <p style="margin: 6px 0 0; font-size: 13px; color: #78350f;">
        <strong>Due Date:</strong> ${formattedDue} (${daysOverdue} days past due)<br/>
        ${description ? `<strong>Description:</strong> ${description}` : ""}
      </p>
    </div>
    <p>Could you please look into this today and confirm when we can expect the remittance?</p>
    <p>If you have already sent payment, please let us know the transaction reference so we can update our records.</p>
    <div class="footer">
      Sent via PayReminder · Helping freelancers and small businesses get paid on time.
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
Despite multiple previous reminders, this account remains unsettled. Please remit payment immediately or contact us today to prevent further collection steps.

Thank you for your prompt attention to this matter.

Sincerely,
PayReminder System`;

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
  .footer { margin-top: 24px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }
</style></head>
<body>
  <div class="card">
    <span class="badge">Final Notice · 14 Days Overdue</span>
    <h2>Urgent Payment Required: ${clientName}</h2>
    <p>Hi ${clientName},</p>
    <p>This is an urgent and final notice regarding your account balance, which is now significantly past due.</p>
    <div class="details-box">
      <div>Total Outstanding:</div>
      <div class="amount">${formattedAmount}</div>
      <p style="margin: 6px 0 0; font-size: 13px; color: #991b1b;">
        <strong>Original Due Date:</strong> ${formattedDue} (${daysOverdue} days past due)<br/>
        ${description ? `<strong>Description:</strong> ${description}` : ""}
      </p>
    </div>
    <p>Please remit payment immediately to resolve this matter. If there is a dispute or question regarding this invoice, please reach out today.</p>
    <div class="footer">
      Sent via PayReminder · Helping freelancers and small businesses get paid on time.
    </div>
  </div>
</body></html>`;

  return { subject, text, html };
}

let cachedTransporter: nodemailer.Transporter | null = null;

export function getMailTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;

  const user = process.env.SMTP_USER || "payreminder.help@gmail.com";
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

  if (!pass) {
    console.warn("[EmailService] No SMTP_PASS provided in environment.");
  }

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return cachedTransporter;
}

export async function sendReminderEmail(
  params: ReminderEmailParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = getMailTransporter();
    const { subject, html, text } = renderReminderEmail(params);
    const fromAddress = process.env.SMTP_USER || "payreminder.help@gmail.com";

    const info = await transporter.sendMail({
      from: `"PayReminder" <${fromAddress}>`,
      to: params.clientEmail,
      subject,
      text,
      html,
    });

    return { success: true, messageId: info.messageId };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[EmailService Error]:", errorMsg);
    return { success: false, error: errorMsg };
  }
}
