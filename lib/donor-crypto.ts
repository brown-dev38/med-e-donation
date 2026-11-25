import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

// Protects donor tax IDs at rest (PDPA). Format: v1:<iv>:<auth tag>:<ciphertext>, base64url parts.
const VERSION = "v1";

function readKeys() {
  const raw = process.env.TAX_ID_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("TAX_ID_ENCRYPTION_KEY is required.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TAX_ID_ENCRYPTION_KEY must be 32 bytes encoded as base64.");
  // A separate derived key for lookup hashes, so the hash never reuses the encryption key directly.
  const hashKey = Buffer.from(hkdfSync("sha256", key, Buffer.alloc(0), "medup-tax-id-lookup-v1", 32));
  return { key, hashKey };
}

export function encryptTaxId(taxId: string) {
  const { key } = readKeys();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(taxId, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptTaxId(encoded: string) {
  const [version, iv, tag, ciphertext, extra] = encoded.split(":");
  if (version !== VERSION || !iv || !tag || !ciphertext || extra !== undefined) throw new Error("Unsupported encrypted tax ID format.");
  const { key } = readKeys();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

/**
 * Keyed SHA-256 (HMAC) for searching by tax ID without decrypting. A plain SHA-256 of a
 * 13-digit number can be reversed by brute force, so the hash is keyed.
 */
export function hashTaxId(taxId: string) {
  return createHmac("sha256", readKeys().hashKey).update(taxId).digest("hex");
}

/** 3560100294812 -> 35601xxxx4812 */
export function maskTaxId(taxId: string) {
  return `${taxId.slice(0, 5)}xxxx${taxId.slice(-4)}`;
}
