/**
 * ICD MCP Server - Type Definitions
 */

import { z } from "zod";

// Server metadata
export const SERVER_NAME = "icd-mcp-server";
export const SERVER_VERSION = "1.0.0";

// Environment interface for Cloudflare Workers
export interface Env {
  WHO_CLIENT_ID: string;
  WHO_CLIENT_SECRET: string;
  ICD10_RELEASE?: string;
  ICD11_RELEASE?: string;
  WHO_API_LANGUAGE?: string;
}

// MCP Tool result type
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// ICD Entity from API
export interface ICDEntity {
  code: string;
  title: string;
  definition?: string;
  longDefinition?: string;
  inclusions?: string[];
  exclusions?: string[];
  codingNote?: string;
  parent?: string;
  children?: string[];
  uri?: string;
  classKind?: string;
  browserUrl?: string;
}

// ICD Search Result
export interface ICDSearchResult {
  code: string;
  title: string;
  score?: number;
  uri: string;
  chapter?: string;
}

// ICD Chapter
export interface ICDChapter {
  code: string;
  title: string;
  uri: string;
}

// WHO Client Config
export interface WHOClientConfig {
  clientId: string;
  clientSecret: string;
  icd10Release?: string;
  icd11Release?: string;
  language?: string;
}

// ICD action schema - single tool with action dispatch
export const ICDParams = z.object({
  action: z.enum(["lookup", "search", "chapters", "children", "api", "help"]),
  code: z.string().optional().describe("ICD code (e.g., A00, J18.9, BA00)"),
  query: z.string().optional().describe("Search terms (ICD-11 only)"),
  version: z.enum(["10", "11"]).optional().describe("ICD version: 10 or 11 (default: 11)"),
  chapter: z.string().optional().describe("Chapter code to filter by"),
  max_results: z.number().optional().describe("Maximum results (default 10)"),
  path: z.string().optional().describe("API path for raw requests"),
});

export type ICDParamsType = z.infer<typeof ICDParams>;
