"use client";

import { useActionState } from "react";
import { payTestOrder, type PayState } from "@/lib/actions/test-payment";
import { formatMoney, type CurrencyCode } from "@/lib/currency";

export function TestCardForm({ orderId, total, currency }: { orderId: string; total: number; currency: CurrencyCode }) {
  const action = payTestOrder.bind(null, orderId);
  const [state, formAction, pending] = useActionState<PayState, FormData>(action, { error: null });
  const v = state.values;

  return (
    <form action={formAction} className="mt-8 space-y-6">
      <div>
        <label htmlFor="name" className="eyebrow block">Name on card</label>
        <input id="name" name="name" required autoComplete="cc-name" defaultValue={v?.name ?? ""} placeholder="As it appears on the card" className="field mt-1" />
      </div>
      <div>
        <label htmlFor="number" className="eyebrow block">Card number</label>
        <input id="number" name="number" required inputMode="numeric" autoComplete="cc-number" defaultValue={v?.number ?? "4242 4242 4242 4242"} placeholder="4242 4242 4242 4242" className="field mt-1 tabular-nums" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <label htmlFor="expiry" className="eyebrow block">Expiry</label>
          <input id="expiry" name="expiry" required inputMode="numeric" autoComplete="cc-exp" defaultValue={v?.expiry ?? "12 / 34"} placeholder="MM / YY" className="field mt-1 tabular-nums" />
        </div>
        <div>
          <label htmlFor="cvc" className="eyebrow block">CVC</label>
          <input id="cvc" name="cvc" required inputMode="numeric" autoComplete="cc-csc" defaultValue={v?.cvc ?? "123"} placeholder="123" className="field mt-1 tabular-nums" />
        </div>
      </div>
      {state.error && (
        <p className="text-sm text-oxblood" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn w-full">
        {pending ? "Processing…" : `Pay ${formatMoney(total, currency)}`}
      </button>
      <p className="text-xs leading-relaxed text-stone">Your card details are encrypted and never stored. Sandbox environment: use card 4242 4242 4242 4242 to complete a purchase.</p>
    </form>
  );
}
