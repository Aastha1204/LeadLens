import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

/** phone_hash = SHA-256(E.164 number + per-client salt) */
export function phoneHash(e164: string, salt: string): string {
  return bytesToHex(sha256(utf8ToBytes(e164 + salt)));
}
