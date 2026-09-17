"use server";

import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { SEASONS } from "@/lib/colour/seasons";

const Profile = z.object({
  season: z.enum(SEASONS.map((s) => s.id) as [string, ...string[]]),
  undertone: z.enum(["warm", "cool", "neutral"]),
  depth: z.enum(["light", "medium", "deep"]),
  clarity: z.enum(["bright", "medium", "soft"]),
  method: z.enum(["photo", "quiz", "manual"]),
});

/** Persist the colour profile against the signed-in account (no-op for guests). */
export async function saveColourProfile(input: unknown): Promise<{ saved: boolean }> {
  const session = await getSession();
  if (!session) return { saved: false };
  const parsed = Profile.safeParse(input);
  if (!parsed.success) return { saved: false };
  const db = await getDb();
  const row = { userId: session.sub, ...parsed.data, updatedAt: new Date().toISOString() };
  await db
    .insert(schema.colourProfiles)
    .values(row)
    .onConflictDoUpdate({ target: schema.colourProfiles.userId, set: row });
  return { saved: true };
}
