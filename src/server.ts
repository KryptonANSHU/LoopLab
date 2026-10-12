import path from "node:path";
import express from "express";
import { getJob, listJobs } from "./jobs/jobStore.js";
import { cancelJob, scheduleOneTimeJob, scheduleRecurringJob } from "./jobs/scheduler.js";
import { validateNewJob } from "./jobs/validate.js";

const PORT = 3000;

const app = express();

app.use(express.json());

// Serves the files in /public. A request for "/" gets public/index.html.
app.use(express.static(path.join(import.meta.dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({
    status: "fine",
    uptimeSec: Math.round(process.uptime()),
    pid: process.pid,
  });
});

app.post("/jobs", (req, res) => {
  const result = validateNewJob(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  const input = result.value;
  const job = input.type === "recurring" ? scheduleRecurringJob(input) : scheduleOneTimeJob(input);
  res.status(201).json({
    id: job.id,
    type: job.type,
    status: job.status,
    runAt: job.runAt,
  });
});

app.get("/jobs", (_req, res) => {
  res.json(listJobs());
});

app.get("/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

app.delete("/jobs/:id", (req, res) => {
  const result = cancelJob(req.params.id);
  if (!result.ok) {
    if (result.reason === "not-found") {
      res.status(404).json({ error: "Job not found" });
    } else {
      res.status(400).json({ error: "Only a scheduled or running job can be cancelled" });
    }
    return;
  }
  res.json({ id: result.job.id, status: result.job.status });
});

app.listen(PORT, (err?: Error) => {
  // Express 5 passes startup errors (for example "port already in use") to this callback.
  if (err) {
    console.error(`Could not start on port ${PORT}:`, err.message);
    process.exit(1);
  }
  console.log(`LoopLab listening on http://localhost:${PORT}`);
});
