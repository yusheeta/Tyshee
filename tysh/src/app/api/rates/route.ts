import { NextResponse } from "next/server";
import { getRates } from "@/lib/rates";

export async function GET() {
  const result = await getRates();
  return NextResponse.json(result, {
    headers: { "cache-control": "public, max-age=3600, s-maxage=43200, stale-while-revalidate=86400" },
  });
}
