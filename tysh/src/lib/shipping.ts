/** Shipping rules shared by the client cart and the server-side repricing. Minor units (USD cents). */
export const FREE_SHIPPING_THRESHOLD = 7500; // $75
export const FLAT_SHIPPING = 790; // $7.90
export const MAX_QTY = 9;

export function shippingFor(subtotal: number): number {
  return subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
}
