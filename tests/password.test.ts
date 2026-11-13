import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../lib/password";

test("password hashes are salted, verify correctly, and reject wrong passwords", async () => {
  const password = "test-password-ที่ปลอดภัย";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
  assert.equal(await verifyPassword(password, second), true);
});

test("invalid hash formats and attacker-controlled scrypt costs are rejected", async () => {
  for (const encoded of ["", "plaintext", "scrypt:1048576:8:1:salt:hash", `scrypt:32768:8:3:${"0".repeat(32)}:${"0".repeat(128)}:extra`]) {
    assert.equal(await verifyPassword("anything", encoded), false);
  }
});
