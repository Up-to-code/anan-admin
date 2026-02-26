/**
 * Search agent types (Serper, PropertyFinding, etc.).
 */

export type SerperResult = {
  title: string;
  description: string;
  externalUrl: string;
  imageUrl?: string;
  imageUrls?: string[];
  qualityScore?: number;
};

export type SerperImageResult = {
  title?: string;
  link?: string;
  imageUrl?: string;
};

export type PropertyCardCandidate = {
  rank: number;
  title: string;
  url?: string;
  snippet?: string;
  imageUrl?: string;
  imageUrls?: string[];
};

export type PropertyFinding = {
  sourceRank: number;
  sourceUrl: string;
  sourceTitle?: string;
  cardRank: number;
  propertyUrl?: string;
  detailSourceUrl?: string;
  detailFetched?: boolean;
  title: string;
  description?: string;
  priceHint?: string;
  locationHint?: string;
  imageUrls: string[];
  offerDetails?: string;
  confidence?: number;
  bathrooms?: string;
  area?: string;
  features?: string[];
  beds?: string;
};

export type SourceRun = {
  rank: number;
  title: string;
  url: string;
  snippet?: string;
};

export type KnowledgePayload = {
  userId: string;
  threadId?: string;
  query: string;
  channel?: "whatsapp" | "app" | "web";
  status: "completed" | "partial" | "failed";
  requestedTopSources: number;
  requestedTopCardsPerSource: number;
  createdAt: number;
  taskList: string[];
  searchTerms: string[];
  sourceRuns: SourceRun[];
  propertyFindings: PropertyFinding[];
  errorSummary?: string;
};

export type UserResult = {
  title: string;
  description: string;
  externalUrl?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  imageUrl?: string;
  imageUrls?: string[];
  priceHint?: string;
  locationHint?: string;
  bathrooms?: string;
  area?: string;
  features?: string[];
  beds?: string;
  country?: string;
  confidence?: number;
};

export type StagehandState = {
  disabled: boolean;
  reason?: string;
};

export interface GenericPortalConfig {
  name: string;
  baseUrl: string;
  buildSearchUrl: (city: string, isRent: boolean, propertyType: 'apartment' | 'villa' | 'land' | 'any') => string | null;
  customInstruction?: string;
}

export type SearchAgentResult = {
  success: boolean;
  knowledgePayload: KnowledgePayload;
  userResults: UserResult[];
  error?: string;
  durationMs: number;
  orchestrationTrace?: Array<{
    stage: string;
    startedAt: number;
    endedAt: number;
    status: "ok" | "error" | "skipped";
    meta?: Record<string, unknown>;
  }>;
  coverageReport?: {
    score: number;
    resultCount: number;
    sourceCount: number;
    imageCoverage: number;
    detailCoverage: number;
    noveltyScore: number;
    shouldRunSecondPass: boolean;
    reason: string;
  };
};
