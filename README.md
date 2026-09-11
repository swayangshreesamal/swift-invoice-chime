# Invoice Pal

Build a simple and clean website called **PayReminder**.

**What the website does:**

PayReminder helps freelancers and small business owners get paid faster.  

Many freelancers send invoices but clients don’t pay on time. They feel awkward chasing the money.  

This tool automatically sends polite reminder emails so the freelancer doesn’t have to do it manually.

**Main Features:**

1. User can create a free account and log in.

2. User can add a new invoice by filling:

   - Client Name

   - Client Email

   - Invoice Amount

   - Invoice Date

   - Due Date

   - Short Description (optional)

3. After adding the invoice, the system automatically sends reminder emails on this schedule:

   - 3 days after due date → Polite reminder

   - 7 days after due date → Firmer reminder

   - 14 days after due date → Final notice

4. Simple Dashboard that shows:

   - All invoices

   - Which invoices are still unpaid

   - Which reminders have already been sent

   - Total amount still waiting to be paid

5. User can mark any invoice as “Paid” with one click.

6. User can edit or delete invoices.

**Pricing:**

- Free Plan → Can track only 3 invoices

- Pro Plan → $19 per month (unlimited invoices + automatic reminders)

**Payment:**

When the user clicks “Upgrade to Pro – $19/month”, show this exact PayPal subscription button:

```html

<div id="paypal-button-container-P-0T982194PC572172WNKRMHEQ"></div>

<script src="https://www.paypal.com/sdk/js?client-id=BAAfpgWRrENfXXGQJoTHPUKITKxodhLascJ8diMsirEGX-Ir_5LzF1w2X-QVATX404EVMEfD3nuFE0r24o&vault=true&intent=subscription" data-sdk-integration-source="button-factory"></script>

<script>

  paypal.Buttons({

      style: {

          shape: 'rect',

          color: 'gold',

          layout: 'vertical',

          label: 'subscribe'

      },

      createSubscription: function(data, actions) {

        return actions.subscription.create({

          /* Creates the subscription */

          plan_id: 'P-0T982194PC572172WNKRMHEQ'

        });

      },

      onApprove: function(data, actions) {

        alert(data.subscriptionID); // You can add optional success message for the subscriber here

      }

  }).render('#paypal-button-container-P-0T982194PC572172WNKRMHEQ'); // Renders the PayPal button

</script>

```

**Design requirements:**

- Extremely simple and clean design

- Mobile friendly

- Soft and professional colors

- Easy to understand for non-technical people

- No complicated menus

- Calm and helpful feeling

Make the whole experience very simple so a freelancer can add an invoice in less than 30 seconds.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b6cb859b-e2fa-4610-9ae8-d4f367c75dd4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
