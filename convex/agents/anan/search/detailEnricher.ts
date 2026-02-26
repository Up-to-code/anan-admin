import { buildFindings } from "./pipeline";
import type { PropertyFinding, SerperResult } from "./types";

import { type GenericActionCtx } from "convex/server";
import { type DataModel } from "../../../_generated/dataModel";

export async function enrichFindingsFromSources(params: {
  ctx: GenericActionCtx<DataModel>;
  sources: SerperResult[];
  imagePool: string[];
  deadlineMs: number;
  limit: number;
  excludePropertyUrls: Set<string>;
  detailEnrichCount?: number;
}): Promise<PropertyFinding[]> {
  return buildFindings(params.ctx, params.sources, params.imagePool, {
    deadlineMs: params.deadlineMs,
    maxFindings: Math.max(params.limit * 2, 10),
    detailEnrichCount: params.detailEnrichCount ?? 3,
    excludePropertyUrls: params.excludePropertyUrls,
  });
}
