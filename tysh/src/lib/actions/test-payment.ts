"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getOrder, markOrderCancelled, markOrderPaid } from "@/lib/orders";

export interface PayState {
  error: string | null;
  /** Echoed back so the form keeps what the visitor typed after a declined attempt. */
  values?: { name: string; number: string; expiry: string; cvc: string };
}

const Card = z.object({
  number: z.string().transform((s) => s.replace(/\s+/g, "")).pipe(z.string().regex(/^\d{13,19}$/, "Enter a valid card number.")),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/, "Expiry must be MM / YY."),
  cvc: z.string().regex(/^\d{3,4}$/, "Enter the 3 or 4 digit security code."),
  name: z.string().trim().min(2, "Enter the name on the card."),
});

function luhn(num: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * Built-in test gateway used when Stripe keys are absent. Mirrors Stripe's test card
 * behaviour: 4242… approves, 4000 0000 0000 0002 declines, 4000 0000 0000 9995 has
 * insufficient funds. Nothing is charged; nothing leaves the server.
 */
export async function payTestOrder(orderId: string, _prev: PayState, formData: FormData): Promise<PayState> {
  const order = await getOrder(orderId);
  if (!order || order.provider !== "test") return { error: "This order cannot be paid here." };
  if (order.status === "paid") redirect(`/checkout/success?order=${order.id}`);
  if (order.status !== "pending") return { error: "This order is no longer payable." };

  const raw = { name: String(formData.get("name") ?? ""), number: String(formData.get("number") ?? ""), expiry: String(formData.get("expiry") ?? ""), cvc: String(formData.get("cvc") ?? "") };
  const fail = (error: string): PayState => ({ error, values: raw });
  const parsed = Card.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the card details.");
  const { number, expiry } = parsed.data;

  const [, mm, yy] = expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/)!;
  const exp = new Date(2000 + parseInt(yy, 10), parseInt(mm, 10), 0);
  if (exp < new Date()) return fail("This card has expired.");
  if (!luhn(number)) return fail("Enter a valid card number.");

  if (number === "4000000000000002") return fail("Your card was declined (test card).");
  if (number === "4000000000009995") return fail("Your card has insufficient funds (test card).");
  if (number !== "4242424242424242" && !number.startsWith("4242")) {
    await markOrderCancelled(order.id);
    return fail("Only Stripe test cards are accepted here. Use 4242 4242 4242 4242.");
  }

  await markOrderPaid(order.id, `test_${Date.now().toString(36)}`);
  redirect(`/checkout/success?order=${order.id}`);
}
