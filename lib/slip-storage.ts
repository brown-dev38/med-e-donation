import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Private files (slips, certificates, signature images) hold personal data, so they are stored
// outside `public/` and served only through authenticated admin routes.
const storageRoot = () => path.resolve(process.env.SLIP_STORAGE_DIR?.trim() || "storage");

export type ImageType = "jpg" | "png";

/** Detects the real image type from magic bytes rather than trusting the browser's MIME type. */
export function detectSlipType(bytes: Uint8Array): ImageType | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length > png.length && png.every((byte, index) => bytes[index] === byte)) return "png";
  return null;
}

export const hashSlip = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Resolves a stored relative path, refusing anything that escapes the storage root. */
export function slipAbsolutePath(relative: string) {
  const root = storageRoot();
  const absolute = path.resolve(root, relative);
  return absolute.startsWith(root + path.sep) ? absolute : null;
}

/** Writes a file under the storage root and returns its relative path (always with `/`). */
export async function savePrivateFile(relative: string, bytes: Uint8Array, options: { overwrite?: boolean } = {}) {
  const absolute = slipAbsolutePath(relative);
  if (!absolute) throw new Error("Invalid storage path.");
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes, { flag: options.overwrite ? "w" : "wx" });
  return relative;
}

export async function readPrivateFile(relative: string) {
  const absolute = slipAbsolutePath(relative);
  if (!absolute) throw new Error("Invalid storage path.");
  return readFile(absolute);
}

/** Saves the slip and returns its path relative to the storage root, e.g. slips/2026/11/<uuid>.jpg */
export async function saveSlip(bytes: Uint8Array, extension: ImageType, now = new Date()) {
  const relative = path.posix.join("slips", String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"), `${randomUUID()}.${extension}`);
  return savePrivateFile(relative, bytes);
}

export async function deleteSlip(relative: string) {
  const absolute = slipAbsolutePath(relative);
  if (absolute) await rm(absolute, { force: true });
}
