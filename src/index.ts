/**
 * ICD MCP Server - Cloudflare Workers Entry Point
 *
 * A Model Context Protocol (MCP) server for the WHO ICD-10/ICD-11 classification.
 * Single tool with action dispatch for token efficiency.
 */

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WHOICDClient } from "./client";
import { handleAction } from "./handlers";
import { Env, SERVER_NAME, SERVER_VERSION, ICDParams } from "./types";

/**
 * Create MCP server with single tool configured for the given environment
 */
function createServer(env: Env) {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const client = new WHOICDClient({
    clientId: env.WHO_CLIENT_ID,
    clientSecret: env.WHO_CLIENT_SECRET,
    icd10Release: env.ICD10_RELEASE || "2019",
    icd11Release: env.ICD11_RELEASE || "2024-01",
    language: env.WHO_API_LANGUAGE || "en",
  });

  // Single tool with action dispatch
  server.tool("icd", ICDParams.shape, async (args) => {
    if (!env.WHO_CLIENT_ID || !env.WHO_CLIENT_SECRET) {
      return {
        content: [{ type: "text" as const, text: "Error: WHO API credentials not configured" }],
        isError: true,
      };
    }

    const params = ICDParams.parse(args);
    return handleAction(params, client);
  });

  return server;
}

/**
 * Health endpoint response
 */
function healthResponse(): Response {
  return new Response(
    JSON.stringify({
      status: "healthy",
      server: SERVER_NAME,
      version: SERVER_VERSION,
      description: "WHO ICD-10 and ICD-11 Classification MCP Server",
      endpoints: {
        mcp: "/mcp",
        health: "/health",
      },
      tool: {
        name: "icd",
        actions: ["lookup", "search", "chapters", "children", "api", "help"],
      },
      documentation: "https://icd.who.int/icdapi",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

/**
 * Main Cloudflare Worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health" || url.pathname === "/") {
      return healthResponse();
    }

    // MCP endpoint - streamable HTTP transport
    if (url.pathname === "/mcp") {
      const server = createServer(env);
      const handler = createMcpHandler(server);
      return handler(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};
