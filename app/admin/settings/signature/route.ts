import { getCurrentAdmin } from "@/lib/auth";
import { getCertificateSettings } from "@/lib/certificate-settings";
import { readPrivateFile } from "@/lib/slip-storage";

export async function GET() {
  if (!(await getCurrentAdmin())) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  const { signatureImagePath } = await getCertificateSettings();
  const bytes = signatureImagePath ? await readPrivateFile(signatureImagePath).catch(() => null) : null;
  if (!signatureImagePath || !bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": signatureImagePath.endsWith(".png") ? "image/png" : "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
