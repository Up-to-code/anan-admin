import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
const internalAny = internal as any;

crons.interval(
  "archive expired agent threads",
  { hours: 1 },
  internalAny.agents.actions.archiveExpiredThreads,
  { limit: 100 }
);

crons.interval(
  "delete expired search cache",
  { minutes: 15 },
  internalAny.services.properties.deleteExpiredKnowledgeResearch,
  { limit: 500 }
);

export default crons;
