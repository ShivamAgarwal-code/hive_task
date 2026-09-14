import { randomUUID } from "node:crypto";

/** Server-side UUID generator. Kept in one place so tests can stay deterministic. */
export function newId(): string {
  return randomUUID();
}
