# PayReminder

**PayReminder** helps freelancers and small business owners get paid on time without the awkward chase. It automatically sends polite, professional payment reminder emails at scheduled intervals (3, 7, and 14 days overdue).

---

## Features

1. **Simple Invoice Tracking**: Add client details, due dates, amounts, and descriptions in under 30 seconds.
2. **Automated 3-Stage Reminders**:
   - **3 Days Overdue**: Polite & gentle nudge
   - **7 Days Overdue**: Firmer reminder requesting payment status
   - **14 Days Overdue**: Final notice requiring urgent settlement
3. **Interactive Dashboard**:
   - Real-time balance tracking (Waiting to be paid vs. Paid)
   - One-click "Mark as Paid" / "Mark as Unpaid"
   - Per-invoice reminder logs and manual triggers (`3d polite`, `7d firmer`, `14d final`)
   - Instant "Check & send reminders" batch scanner
4. **PayPal Pro Subscription**: Seamless PayPal subscription flow unlocking unlimited invoices and automated reminders for $19/month.
5. **Scheduled Daily Cron**: Automated daily invoice scan via `/api/cron/reminders`.

---

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React 19 + Vite)
- **Styling**: Tailwind CSS & Modern Paper Aesthetic
- **Database & Auth**: Supabase (PostgreSQL + Row-Level Security)
- **Email Delivery**: NodeMailer with Gmail SMTP (or Resend)
- **Deployment**: Vercel

---

## Getting Started

### 1. Install Dependencies

```sh
npm install
```

### 2. Environment Variables

Create a `.env` or `.env.local` file with:

```env
SUPABASE_URL="https://c--b6cb859b-e2fa-4610-9ae8-d4f367c75dd4-prod.lovable.cloud"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_Qf_4_y0Wcb8OpREEqVfngw_bHkMm2El"
SUPABASE_PROJECT_ID="resvgmfhbhkvecuhnqqz"
VITE_SUPABASE_URL="https://c--b6cb859b-e2fa-4610-9ae8-d4f367c75dd4-prod.lovable.cloud"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_Qf_4_y0Wcb8OpREEqVfngw_bHkMm2El"
VITE_SUPABASE_PROJECT_ID="resvgmfhbhkvecuhnqqz"
SMTP_USER="payreminder.help@gmail.com"
SMTP_PASS="your-app-password"
```

### 3. Run Development Server

```sh
npm run dev
```

### 4. Run Tests & Linting

```sh
npm test
npm run lint
npm run build
```
