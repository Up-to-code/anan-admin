import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "archive expired agent threads",
  { hours: 1 },
  internal.agents.actions.archiveExpiredThreads,
  { limit: 100 }
);

crons.interval(
  "delete expired search cache",
  { minutes: 15 },
  internal.services.properties.deleteExpiredKnowledgeResearch,
  { limit: 500 }
);

export default crons;
