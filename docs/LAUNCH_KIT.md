# PayReminder — User Acquisition & Launch Kit

Everything you need to launch PayReminder on Product Hunt, Reddit, Indie Hackers, Twitter/X, and freelance communities.

---

## 1. Product Descriptions

### One-Liner (Tagline)
> **"Get paid on time without the awkward chase."**

### Elevator Pitch (30 Seconds)
> "Chasing unpaid invoices is the most uncomfortable part of freelancing. You wait weeks, send hesitant emails, and damage relationships. PayReminder is a calm, neutral collection assistant: add an invoice once in 30 seconds, and it sends polite, escalating email reminders with your direct payment link until you get paid. Zero platform commission, 3 invoices free forever."

### 100-Word Description
> "PayReminder helps freelancers, contractors, and agencies get paid without having to awkwardly ask. Whenever an invoice is overdue, PayReminder delivers scheduled, respectful reminders on day 3 (gentle check-in), day 7 (firmer notice), and day 14 (final notice with optional late fee policy). Every email features a prominent highlighted box with who to pay and how to pay (PayPal, UPI, Stripe, or Bank wire) and a 1-click payment button. You can store private client notes, track paid vs unpaid invoices, and let reminders run on autopilot. Free for 3 invoices; $19/month for unlimited."

---

## 2. Screenshot Checklist (Take These 5 Screenshots)

To make your launch post stand out with high engagement, capture these 5 clean screenshots:

1. **Dashboard Overview (`screenshot_1_dashboard.png`)**
   - URL: `https://swift-invoice-chime.vercel.app/dashboard`
   - Capture: The big "Waiting to be paid" counter ($2,500+), the "Your Default Payment Details" card, and 2–3 sample invoices with clean badges (`💳 Custom payment info`, `Sent · 3d`).
2. **The 3-Day Friendly Reminder Email (`screenshot_2_email_3d.png`)**
   - Capture: The gentle green highlighted box (`💳 How & Where to Pay`), your name, due date, payment details, and the green `Pay Online Now →` button.
3. **The 14-Day Urgent Final Notice (`screenshot_3_email_14d.png`)**
   - Capture: The stark red settlement box (`🚨 Immediate Settlement Instructions`), the yellow/red `⚠️ Late Fee Notice` banner, and the red payment button.
4. **Invoice Creation Modal (`screenshot_4_invoice_modal.png`)**
   - Capture: The clean invoice form showing the pre-filled payment details, optional late fee input, and private client notes field (`🔒 Private client notes`).
5. **Mobile View (`screenshot_5_mobile.png`)**
   - Capture: Chrome DevTools iPhone view of the landing page hero ("Stop awkwardly chasing clients. Let PayReminder do the knocking").

---

## 3. Launch Posts (Ready to Copy & Paste)

### A. Product Hunt Launch

**Name:** PayReminder  
**Tagline:** Calm, automated invoice reminders for freelancers who hate chasing money  
**Primary Category:** Productivity / Freelance / Finance  
**Pricing:** Free + Paid ($19/mo)  

**Maker First Comment (Paste as soon as your PH post goes live):**
```markdown
Hey Product Hunt! 👋

I'm the creator of PayReminder.

As a freelancer, the absolute worst part of the job was sending that dreaded follow-up email:
*"Hey... just gently following up on invoice #104... totally understand if you're busy..."*

It feels awkward, unprofessional, and confrontational. You feel like a pest asking for money you already worked hard for.

So I built PayReminder to act as a calm, neutral third-party reminder system.

Here's how it works:
1. Add your invoice in 30 seconds (client email, amount, due date, and your PayPal/UPI/Bank details).
2. If unpaid, PayReminder delivers scheduled notices:
   • Day 3: Polite, friendly check-in.
   • Day 7: Professional firmer follow-up.
   • Day 14: Clear final notice (with an optional late fee warning).
3. Every email features a prominent highlighted box with who to pay and how to pay, plus a 1-click online payment button.
4. When they pay, click "Mark as paid" on your dashboard and reminders stop immediately.

0% platform commission — payments go 100% directly into your accounts.

It's completely free for up to 3 invoices forever. If you want unlimited invoices and automatic daily checking, Pro is $19/mo.

I'd love to hear your feedback, feature ideas, and any horror stories of chasing invoices!
```

---

### B. Reddit Posts

#### 1. Post for `r/freelance` & `r/webdev`
**Title:** I built a simple tool to solve the most awkward part of freelancing (chasing overdue payments)

**Body:**
```markdown
Hey everyone,

Like most freelancers here, I’ve had clients who are great to work with, but take forever to pay invoices. 

Sending reminder emails was always excruciating because:
- You don't want to sound desperate or aggressive.
- You don't want to ruin the relationship for future projects.
- But at the same time, you have bills to pay.

I built https://swift-invoice-chime.vercel.app to automate this completely.

Instead of an email coming from you sounding irritated, it sends clean, neutral notices on behalf of your business:
- Day 3: Gentle nudge ("Just checking in on this invoice")
- Day 7: Firmer reminder ("This invoice is 7 days past due")
- Day 14: Formal final notice with settlement instructions and optional late fee

The best part is every email clearly highlights WHO to pay and HOW to pay (UPI, PayPal, Bank wire) with a direct 1-click link so clients have zero excuses like "can you resend your bank details?".

It's 100% free for up to 3 invoices (no credit card needed).

Would love any thoughts or feedback from fellow freelancers!
```

#### 2. Post for `r/SideProject` & `r/IndieHackers`
**Title:** PayReminder — A minimalist SaaS that knocked on overdue invoices so I don’t have to

**Body:**
```markdown
Hey r/SideProject!

I built PayReminder (https://swift-invoice-chime.vercel.app) to scratch my own itch: getting paid without the awkward chase.

Tech Stack:
- Frontend: TanStack Start + React + Tailwind CSS
- Backend: Nitro server handlers + Nodemailer (Gmail SMTP)
- Database & Auth: Supabase (PostgreSQL + RLS)
- Subscriptions: PayPal Subscriptions ($19/mo)
- Hosting: Vercel with scheduled cron jobs

Key features:
- Multi-channel payment details (PayPal link, UPI, Stripe, Bank Wire)
- Escalating email templates with highlighted settlement callouts
- Private client notes (track which clients usually pay late)
- Optional 14-day late fee policy

Free plan allows 3 invoices; Pro unlocks unlimited. Would love feedback on the landing page messaging and conversion flow!
```

---

### C. Indie Hackers "Building in Public" Post

**Title:** How I automated the most uncomfortable part of client work

**Body:**
```markdown
A client owes you $1,500. It's 10 days past due. You stare at your drafts folder rewriting the same email for the fourth time trying to sound "friendly yet firm".

Sounds familiar?

I realized that the biggest problem with freelance collections is psychological:
When the freelancer asks personally, it feels emotional. When a system sends an automated notification, it feels procedural.

Clients prioritize procedural notices because they look like standard accounting.

That’s why I launched PayReminder (https://swift-invoice-chime.vercel.app). 
A dead-simple app where you enter an invoice once, specify your payment info, and let the system send escalating 3d / 7d / 14d notices until you get paid.

My goal this month: reach 50 active freelancers on the free tier and convert the first 5 Pro subscribers ($19/mo).

Any advice from the IH community on cold outreach to design and development agencies?
```
