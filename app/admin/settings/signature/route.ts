import { getCurrentStaff } from "@/lib/auth";
import { getCertificateSettings } from "@/lib/certificate-settings";
import { readPrivateFile } from "@/lib/slip-storage";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  if (staff.role !== "ADMIN") return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } }); // settings are admin-only
  const { signatureImagePath } = await getCertificateSettings();
  const bytes = signatureImagePath ? await readPrivateFile(signatureImagePath).catch(() => null) : null;
  if (!signatureImagePath || !bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": signatureImagePath.endsWith(".png") ? "image/png" : "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
