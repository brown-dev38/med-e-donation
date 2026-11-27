import type { NextRequest } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { getCertificatePdf } from "@/lib/donor-notifications";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Certificates name the donor, so they need an admin session and are never cached by shared caches.
export async function GET(_request: NextRequest, ctx: RouteContext<"/admin/certificates/[id]">) {
  if (!(await getCurrentStaff())) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const file = await getCertificatePdf(id).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
