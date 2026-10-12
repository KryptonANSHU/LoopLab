import { randomUUID } from "node:crypto";
import { getJob, saveJob, type Job } from "./jobStore.js";
import type { ValidJobInput } from "./validate.js";

type OneTimeInput = Extract<ValidJobInput, { type: "one-time" }>;
type RecurringInput = Extract<ValidJobInput, { type: "recurring" }>;
type TimerHandle = ReturnType<typeof setTimeout>;

// The work a job does on each run. It may take time (return a Promise).
export type JobTask = (job: Job) => void | Promise<void>;

// Timer handles live here, not on the Job, so Job stays plain JSON data.
const timers = new Map<string, TimerHandle>();

function logMessage(job: Job): void {
  console.log(`[job ${job.id}] ${job.message}`);
}

// A function call makes TypeScript forget what it knew about job.status.
// We need that, because cancelJob can change the status while a run is awaiting.
function isCancelled(job: Job): boolean {
  return job.status === "cancelled";
}

async function runJob(job: Job, task: JobTask): Promise<void> {
  job.status = "running";
  try {
    await task(job);
    job.runs += 1;
    if (!isCancelled(job)) {
      // A recurring job goes back to waiting for its next run.
      job.status = job.type === "recurring" ? "scheduled" : "done";
    }
  } catch (err) {
    // This catch means runJob never rejects, so one bad job cannot crash the server.
    if (!isCancelled(job)) {
      job.status = "failed";
    }
    console.error(`[job ${job.id}] failed:`, err);
  }
}

function createJob(fields: Pick<Job, "type" | "message" | "delayMs" | "intervalMs">, waitMs: number): Job {
  const job: Job = {
    id: randomUUID(),
    ...fields,
    status: "scheduled",
    runAt: new Date(Date.now() + waitMs).toISOString(),
    runs: 0,
    trace: [],
  };
  saveJob(job);
  return job;
}

export function scheduleOneTimeJob(input: OneTimeInput, task: JobTask = logMessage): Job {
  const job = createJob(
    { type: "one-time", message: input.message, delayMs: input.delayMs },
    input.delayMs,
  );

  // setTimeout does not wait. It registers the callback and returns right away.
  const handle = setTimeout(() => {
    timers.delete(job.id);
    void runJob(job, task);
  }, input.delayMs);
  timers.set(job.id, handle);

  return job;
}

export function scheduleRecurringJob(input: RecurringInput, task: JobTask = logMessage): Job {
  const job = createJob(
    { type: "recurring", message: input.message, intervalMs: input.intervalMs },
    input.intervalMs,
  );
  scheduleNextRun(job, input.intervalMs, task);
  return job;
}

// Why not setInterval? setInterval fires every N ms even if the last run is still going,
// so slow runs would overlap. Here the next timer starts only AFTER the run has ended.
function scheduleNextRun(job: Job, intervalMs: number, task: JobTask): void {
  const handle = setTimeout(async () => {
    timers.delete(job.id);
    await runJob(job, task);

    // Still "scheduled" means the run went well and nobody cancelled the job.
    if (job.status === "scheduled") {
      job.runAt = new Date(Date.now() + intervalMs).toISOString();
      scheduleNextRun(job, intervalMs, task);
    }
  }, intervalMs);
  timers.set(job.id, handle);
}

export type CancelResult =
  | { ok: true; job: Job }
  | { ok: false; reason: "not-found" | "not-cancellable" };

export function cancelJob(id: string): CancelResult {
  const job = getJob(id);
  if (!job) {
    return { ok: false, reason: "not-found" };
  }
  if (job.status !== "scheduled" && job.status !== "running") {
    return { ok: false, reason: "not-cancellable" };
  }

  // clearTimeout removes the timer from Node's list, so the callback never runs.
  const handle = timers.get(id);
  if (handle) {
    clearTimeout(handle);
    timers.delete(id);
  }
  job.status = "cancelled";
  return { ok: true, job };
}
