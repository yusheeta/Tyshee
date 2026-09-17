"use server";

import { z } from "zod";
import { getDb, schema } from "@/lib/db";

export interface NewsletterState {
  ok: boolean;
  message: string;
}

const Email = z.string().trim().toLowerCase().email();

export async function subscribeNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const parsed = Email.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: "Please enter a valid email address." };
  const db = await getDb();
  await db
    .insert(schema.newsletterSubscribers)
    .values({ email: parsed.data, createdAt: new Date().toISOString() })
    .onConflictDoNothing();
  return { ok: true, message: "Thank you. You are on the list." };
}
