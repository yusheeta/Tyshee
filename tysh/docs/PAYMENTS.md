# Payments

TYSHEE never handles a real card. Two modes exist, chosen automatically from the environment.

## 1. Stripe Checkout (test mode)

Set in `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…        # optional locally, required in production
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Flow:

1. `POST /api/checkout` re-prices every bag line from the catalogue (`src/lib/orders.ts →
   priceLines`), validates colour + size, records a **pending** order and its items, then
   creates a Stripe Checkout Session with `price_data` line items (name, colour/size,
   CDN thumbnail), an optional shipping line, `client_reference_id = orderId` and
   `metadata.orderId`.
2. The browser is redirected to Stripe. Test card: `4242 4242 4242 4242`, any future
   expiry, any CVC.
3. Fulfilment happens in `POST /api/webhooks/stripe` on `checkout.session.completed`
   (signature-verified). `checkout.session.expired` cancels the order.
4. `/checkout/success?order=…&session_id=…` also retrieves the session directly and marks
   the order paid if `payment_status === "paid"`, so local development works without the
   Stripe CLI. Marking is idempotent (`status = 'pending'` guard).

Local webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copy the printed whsec_… into STRIPE_WEBHOOK_SECRET
```

## 2. Built-in test gateway (no keys)

When `STRIPE_SECRET_KEY` is absent, `/api/checkout` returns `{ url: "/checkout/pay/<orderId>" }`.
That page renders a card form handled by the `payTestOrder` server action
(`src/lib/actions/test-payment.ts`), which mirrors Stripe's test-card semantics:

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Approved → order **paid**, redirect to success |
| `4000 0000 0000 0002` | "Your card was declined" |
| `4000 0000 0000 9995` | "Insufficient funds" |
| anything else | Rejected; order cancelled |

Validation: Luhn check, `MM / YY` expiry in the future, 3–4 digit CVC. Typed values are
echoed back on failure so a declined attempt does not clear the form.

## Razorpay

The request allowed either Stripe or Razorpay. Stripe was chosen for the hosted-checkout
simplicity and USD pricing. Swapping in Razorpay is contained to two files:
`src/app/api/checkout/route.ts` (create an Order via `razorpay.orders.create`, return the
`order_id` for Razorpay Checkout.js) and a webhook route verifying `X-Razorpay-Signature`
before calling `markOrderPaid`. Order persistence and the success page are provider-agnostic.

## Currency

The bag is priced in the visitor's currency (cookie `tysh_currency`, set by geo-detection in
`src/proxy.ts` or by the selector). `POST /api/checkout` receives the currency, re-prices
every line from the USD catalogue with the server's rate table (`src/lib/rates.ts`) using the
same rounding the storefront displayed, and creates the Stripe session in that currency
(`unit_amount` in minor units; JPY is zero-decimal). The order row stores `currency`,
converted `subtotal`/`shipping`/`total`, the `fx_rate` used and `base_total` in USD cents.

## Data

Orders live in the `orders` / `order_items` tables (`src/lib/db/schema.ts`), keyed by a
random `ord_…` id, linked to the user when signed in, with the shipping address stored as
JSON. Prices are integer cents; totals are recomputed server-side and stored with the order.
