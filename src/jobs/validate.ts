const MAX_MESSAGE_LENGTH = 200;
const MIN_DELAY_MS = 0;
const MAX_DELAY_MS = 3_600_000; // 1 hour. setTimeout breaks above ~24.8 days, so we cap it.
const MIN_INTERVAL_MS = 100;
const MAX_INTERVAL_MS = 3_600_000;

export type ValidJobInput =
  | { type: "one-time"; message: string; delayMs: number }
  | { type: "recurring"; message: string; intervalMs: number };

export type ValidationResult =
  | { ok: true; value: ValidJobInput }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWholeNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

// The body comes from the outside world, so its type is `unknown`, not `any`.
// We must check it before we can use it.
export function validateNewJob(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const { message, delayMs, intervalMs } = body;

  if (typeof message !== "string" || message.length < 1 || message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `message must be a string of 1 to ${MAX_MESSAGE_LENGTH} characters` };
  }

  const hasDelay = delayMs !== undefined;
  const hasInterval = intervalMs !== undefined;

  if (hasDelay === hasInterval) {
    return { ok: false, error: "Send exactly one of delayMs or intervalMs" };
  }

  if (hasDelay) {
    if (!isWholeNumberInRange(delayMs, MIN_DELAY_MS, MAX_DELAY_MS)) {
      return { ok: false, error: `delayMs must be a whole number from ${MIN_DELAY_MS} to ${MAX_DELAY_MS}` };
    }
    return { ok: true, value: { type: "one-time", message, delayMs } };
  }

  if (!isWholeNumberInRange(intervalMs, MIN_INTERVAL_MS, MAX_INTERVAL_MS)) {
    return { ok: false, error: `intervalMs must be a whole number from ${MIN_INTERVAL_MS} to ${MAX_INTERVAL_MS}` };
  }
  return { ok: true, value: { type: "recurring", message, intervalMs } };
}
