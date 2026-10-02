import { z } from "zod";

export const RESEARCH_LIMITS = {
  maxSearches: 3,
  maxExtracts: 12,
  maxResults: 15,
  minResults: 1,
  maxQueryLength: 400,
  extractChars: 4000,
} as const;

export const researchInputSchema = z.object({
  query: z.string().trim().min(2).max(RESEARCH_LIMITS.maxQueryLength),
  objective: z.string().trim().max(500).optional(),
  location: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(RESEARCH_LIMITS.maxResults).optional(),
  excludeHosts: z.array(z.string().trim().min(1).max(200)).max(40).optional(),
});

export type ResearchInput = z.infer<typeof researchInputSchema>;

export const sourceSchema = z.object({
  url: z.string().url(),
  title: z.string().trim().min(1).max(240),
});

export const prospectRowSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(160),
  website: z.string().url(),
  location: z.string().trim().max(160).nullable(),
  description: z.string().trim().max(400).nullable(),
  whyMatch: z.string().trim().min(1).max(400),
  verification: z.enum(["verified", "needs_review"]),
  sources: z.array(sourceSchema).min(1).max(6),
  researchedAt: z.string().min(1),
});

export type ProspectRow = z.infer<typeof prospectRowSchema>;

export const researchArtifactDataSchema = z.object({
  type: z.literal("research_results"),
  objective: z.string(),
  location: z.string().nullable(),
  requested: z.number().int(),
  found: z.number().int(),
  verified: z.number().int(),
  needsReview: z.number().int(),
  parentArtifactId: z.string().nullable(),
  revision: z.number().int(),
  researchedAt: z.string(),
  searchCalls: z.number().int(),
  extractCalls: z.number().int(),
  provider: z.string(),
  rows: z.array(prospectRowSchema).max(RESEARCH_LIMITS.maxResults),
});

export type ResearchArtifactData = z.infer<typeof researchArtifactDataSchema>;

export const refineResearchSchema = z.object({
  artifactId: z.string().max(64).optional(),
  action: z.enum(["exclude_index", "keep_location", "keep_indexes", "keep_strongest"]),
  index: z.number().int().min(1).max(RESEARCH_LIMITS.maxResults).optional(),
  indexes: z.array(z.number().int().min(1).max(RESEARCH_LIMITS.maxResults)).max(15).optional(),
  count: z.number().int().min(1).max(RESEARCH_LIMITS.maxResults).optional(),
  location: z.string().trim().max(120).optional(),
});

export type RefineResearchInput = z.infer<typeof refineResearchSchema>;
