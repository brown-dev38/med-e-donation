import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slipAbsolutePath } from "@/lib/slip-storage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png" };

// Slips contain personal banking data: admin session required, never cached by shared caches.
export async function GET(_request: NextRequest, ctx: RouteContext<"/admin/slips/[id]">) {
  const admin = await getCurrentAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const donation = await prisma.donation.findUnique({ where: { donationId: id }, select: { slipFilePath: true } });
  const absolute = donation && slipAbsolutePath(donation.slipFilePath);
  const type = donation && TYPES[donation.slipFilePath.split(".").pop() ?? ""];
  if (!absolute || !type) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(absolute);
    return new Response(bytes, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Slip file is missing", { status: 404 });
  }
}
