export type JobStatus = "scheduled" | "running" | "done" | "cancelled" | "failed";

export type JobType = "one-time" | "recurring";

// Filled in during Milestone 2. Each step is a name like "nextTick" or "promise".
export type Trace = string[];

export interface Job {
  id: string;
  type: JobType;
  message: string;
  status: JobStatus;
  delayMs?: number; // one-time jobs only
  intervalMs?: number; // recurring jobs only
  runAt: string; // ISO time of the next planned run
  runs: number;
  trace: Trace; // trace of the last run
}

// The whole "database": lost when the server restarts.
const jobs = new Map<string, Job>();

export function saveJob(job: Job): void {
  jobs.set(job.id, job);
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function listJobs(): Job[] {
  return [...jobs.values()];
}
