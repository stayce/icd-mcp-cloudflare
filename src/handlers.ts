/**
 * ICD MCP Server - Action Handlers
 */

import { WHOICDClient } from "./client";
import { ToolResult, ICDParamsType, ICDEntity } from "./types";

/**
 * Format an ICD entity for display
 */
function formatEntity(entity: ICDEntity, version: string): string {
  const lines: string[] = [`**${entity.code}**: ${entity.title}`];

  if (entity.definition) {
    lines.push(`\n**Definition:** ${entity.definition}`);
  }

  if (entity.longDefinition && entity.longDefinition !== entity.definition) {
    lines.push(`\n**Details:** ${entity.longDefinition}`);
  }

  if (entity.codingNote) {
    lines.push(`\n**Coding Note:** ${entity.codingNote}`);
  }

  if (entity.inclusions && entity.inclusions.length > 0) {
    lines.push("\n**Includes:**");
    for (const inc of entity.inclusions.slice(0, 10)) {
      lines.push(`  - ${inc}`);
    }
    if (entity.inclusions.length > 10) {
      lines.push(`  - ... and ${entity.inclusions.length - 10} more`);
    }
  }

  if (entity.exclusions && entity.exclusions.length > 0) {
    lines.push("\n**Excludes:**");
    for (const exc of entity.exclusions.slice(0, 10)) {
      lines.push(`  - ${exc}`);
    }
    if (entity.exclusions.length > 10) {
      lines.push(`  - ... and ${entity.exclusions.length - 10} more`);
    }
  }

  if (entity.browserUrl) {
    lines.push(`\n**Browser:** ${entity.browserUrl}`);
  }

  lines.push(`\n_ICD-${version}_`);

  return lines.join("\n");
}

/**
 * Main action dispatcher
 */
export async function handleAction(
  params: ICDParamsType,
  client: WHOICDClient
): Promise<ToolResult> {
  try {
    const version = params.version || "11";

    switch (params.action) {
      case "lookup":
        if (!params.code) throw new Error("code required for lookup");
        return await handleLookup(params.code, version, client);

      case "search":
        if (!params.query) throw new Error("query required for search");
        if (version === "10") {
          return {
            content: [
              {
                type: "text",
                text: "ICD-10 search is not supported by the WHO API. Use ICD-11 search or lookup by code.\n\nTry: {\"action\": \"search\", \"query\": \"pneumonia\", \"version\": \"11\"}",
              },
            ],
            isError: true,
          };
        }
        return await handleSearch(params.query, params.max_results || 10, params.chapter, client);

      case "chapters":
        return await handleChapters(version, client);

      case "children":
        if (!params.code) throw new Error("code required for children");
        return await handleChildren(params.code, version, client);

      case "api":
        if (!params.path) throw new Error("path required for api");
        return await handleApi(params.path, client);

      case "help":
        return handleHelp();

      default:
        return {
          content: [{ type: "text", text: `Unknown action: ${params.action}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
}

async function handleLookup(
  code: string,
  version: string,
  client: WHOICDClient
): Promise<ToolResult> {
  const entity =
    version === "10"
      ? await client.getICD10Code(code)
      : await client.getICD11Code(code);

  if (!entity) {
    return {
      content: [
        {
          type: "text",
          text: `ICD-${version} code '${code}' not found.\n\nTry searching: {"action": "search", "query": "...", "version": "${version}"}`,
        },
      ],
    };
  }

  return {
    content: [{ type: "text", text: formatEntity(entity, version) }],
  };
}

async function handleSearch(
  query: string,
  maxResults: number,
  chapter: string | undefined,
  client: WHOICDClient
): Promise<ToolResult> {
  const results = await client.searchICD11(query, maxResults, chapter);

  if (results.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No ICD-11 codes found for '${query}'. Try different search terms.`,
        },
      ],
    };
  }

  const lines: string[] = [`**ICD-11 Search Results for '${query}':**\n`];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    lines.push(`${i + 1}. **${result.code}**: ${result.title}`);
  }

  lines.push('\nUse {"action": "lookup", "code": "..."} for full details.');

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

async function handleChapters(
  version: string,
  client: WHOICDClient
): Promise<ToolResult> {
  const chapters =
    version === "10"
      ? await client.getICD10Chapters()
      : await client.getICD11Chapters();

  if (chapters.length === 0) {
    return {
      content: [{ type: "text", text: `Could not retrieve ICD-${version} chapters.` }],
    };
  }

  const lines: string[] = [`**ICD-${version} Chapters:**\n`];

  for (const chapter of chapters) {
    lines.push(`- **${chapter.code}**: ${chapter.title}`);
  }

  lines.push(`\nUse {"action": "children", "code": "..."} to explore a chapter.`);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

async function handleChildren(
  code: string,
  version: string,
  client: WHOICDClient
): Promise<ToolResult> {
  const children =
    version === "10"
      ? await client.getICD10Children(code)
      : await client.getICD11Children(code);

  if (children.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No child codes found for '${code}'. This may be a leaf-level code.`,
        },
      ],
    };
  }

  const lines: string[] = [`**Child codes under ${code} (ICD-${version}):**\n`];

  for (const child of children) {
    lines.push(`- **${child.code}**: ${child.title}`);
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

async function handleApi(path: string, client: WHOICDClient): Promise<ToolResult> {
  if (!path.startsWith("/")) {
    return {
      content: [{ type: "text", text: "Path must start with /" }],
      isError: true,
    };
  }

  try {
    const result = await client.apiRequest(path);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `API Error: ${message}` }],
      isError: true,
    };
  }
}

function handleHelp(): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: `# ICD MCP Server

Supports both **ICD-10** and **ICD-11** via the WHO ICD-API.

## Actions

**lookup** - Get code details
  {"action": "lookup", "code": "A00"}              (ICD-11 default)
  {"action": "lookup", "code": "J18.9", "version": "10"}

**search** - Find codes by keyword (ICD-11 only)
  {"action": "search", "query": "pneumonia"}
  {"action": "search", "query": "diabetes", "chapter": "05"}

**chapters** - List chapters
  {"action": "chapters"}
  {"action": "chapters", "version": "10"}

**children** - Get subcodes
  {"action": "children", "code": "BA00"}

**api** - Raw WHO API request
  {"action": "api", "path": "/icd/release/11/2024-01/mms"}

## ICD-10 vs ICD-11

| Feature | ICD-10 | ICD-11 |
|---------|--------|--------|
| Lookup | Yes | Yes |
| Search | No* | Yes |
| Chapters | Yes | Yes |
| Children | Yes | Yes |

*ICD-10 search not supported by WHO API

## More Info
- ICD-10: https://icd.who.int/browse10
- ICD-11: https://icd.who.int/browse11`,
      },
    ],
  };
}
