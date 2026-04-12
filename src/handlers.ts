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

      case "autocode":
        if (!params.query) throw new Error("query required for autocode (clinical description text)");
        return await handleAutocode(params.query, client);

      case "browse":
        return await handleBrowse(params.code, version, client);

      case "ancestors":
        if (!params.code) throw new Error("code required for ancestors");
        return await handleAncestors(params.code, version, client);

      case "validate":
        if (!params.code) throw new Error("code required for validate");
        return await handleValidate(params.code, version, client);

      case "coding_rules":
        return handleCodingRules(params.topic);

      case "overview":
        return handleOverview(version);

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

async function handleAutocode(
  text: string,
  client: WHOICDClient
): Promise<ToolResult> {
  const result = await client.autocodeICD11(text);

  if (!result) {
    return {
      content: [
        {
          type: "text",
          text: `No ICD-11 code matched for: "${text}"\n\nTry rephrasing, or use {"action": "search", "query": "..."} for keyword search.`,
        },
      ],
    };
  }

  const lines: string[] = [
    `**Autocode Result for:** "${text}"\n`,
    `**${result.code}**: ${result.title}`,
  ];

  if (result.score !== undefined) {
    lines.push(`**Confidence:** ${(result.score * 100).toFixed(1)}%`);
  }

  lines.push(`\nUse {"action": "lookup", "code": "${result.code}"} for full details.`);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

async function handleBrowse(
  code: string | undefined,
  version: string,
  client: WHOICDClient
): Promise<ToolResult> {
  // No code = show chapters (top-level browse)
  if (!code) {
    return await handleChapters(version, client);
  }

  // Look up the code, then show it + its children in one view
  const entity =
    version === "10"
      ? await client.getICD10Code(code)
      : await client.getICD11Code(code);

  if (!entity) {
    return {
      content: [
        {
          type: "text",
          text: `ICD-${version} code '${code}' not found.\n\nTry: {"action": "browse"} to start from chapters.`,
        },
      ],
    };
  }

  const lines: string[] = [`**Browsing ${entity.code}: ${entity.title}** (ICD-${version})\n`];

  if (entity.definition) {
    lines.push(`${entity.definition}\n`);
  }

  // Show parent for context
  if (entity.parent) {
    const parentEntity = await client.getEntityByUri(entity.parent);
    if (parentEntity) {
      lines.push(`**Parent:** ${parentEntity.code || "Root"} - ${parentEntity.title}`);
    }
  }

  // Show children
  if (entity.children && entity.children.length > 0) {
    const children: ICDEntity[] = [];
    for (const childUri of entity.children.slice(0, 25)) {
      const child = await client.getEntityByUri(childUri);
      if (child) children.push(child);
    }

    if (children.length > 0) {
      lines.push(`\n**Sub-categories (${children.length}${entity.children.length > 25 ? "+" : ""}):**`);
      for (const child of children) {
        const hasKids = child.children && child.children.length > 0 ? " ▸" : "";
        lines.push(`- **${child.code}**: ${child.title}${hasKids}`);
      }
    }
  } else {
    lines.push("\n_This is a leaf-level code (no sub-categories)._");
  }

  lines.push(`\nUse {"action": "browse", "code": "..."} to drill into a sub-category.`);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

async function handleAncestors(
  code: string,
  version: string,
  client: WHOICDClient
): Promise<ToolResult> {
  const ancestors =
    version === "10"
      ? await client.getICD10Ancestors(code)
      : await client.getICD11Ancestors(code);

  if (ancestors.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `ICD-${version} code '${code}' not found.\n\nTry: {"action": "lookup", "code": "${code}"}`,
        },
      ],
    };
  }

  const lines: string[] = [`**Lineage for ${code} (ICD-${version}):**\n`];

  // Reverse so chapter is first, leaf is last
  const lineage = [...ancestors].reverse();
  for (let i = 0; i < lineage.length; i++) {
    const indent = "  ".repeat(i);
    const marker = i === lineage.length - 1 ? "→" : "└";
    lines.push(`${indent}${marker} **${lineage[i].code || "Root"}**: ${lineage[i].title}`);
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

async function handleValidate(
  code: string,
  version: string,
  client: WHOICDClient
): Promise<ToolResult> {
  const { valid, entity } = await client.validateCode(code, version);

  if (!valid) {
    return {
      content: [
        {
          type: "text",
          text: `**${code}** is **not a valid** ICD-${version} code.\n\nTry {"action": "search", "query": "..."} to find the correct code.`,
        },
      ],
    };
  }

  const lines: string[] = [
    `**${code}** is a **valid** ICD-${version} code.\n`,
    `**Title:** ${entity!.title}`,
  ];

  if (entity!.classKind) {
    lines.push(`**Class:** ${entity!.classKind}`);
  }

  const hasChildren = entity!.children && entity!.children.length > 0;
  lines.push(`**Level:** ${hasChildren ? "Category (has sub-codes)" : "Leaf code (terminal)"}`);

  if (entity!.browserUrl) {
    lines.push(`**Browser:** ${entity!.browserUrl}`);
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

function handleCodingRules(topic?: string): ToolResult {
  const topics: Record<string, string> = {
    extension_codes: `# ICD-11 Extension Codes

Extension codes add detail to stem codes but **cannot be used alone**.

**Categories:**
- **Severity** (XS0-XS9): e.g., XS0M Mild, XS1G Moderate, XS28 Severe
- **Temporality** (XT0-XT9): e.g., XT0Y Acute, XT20 Chronic, XT4G Recurrent
- **Anatomy** (XA0-XA9): specific site detail
- **Histopathology** (XH0-XH9): tissue type
- **Dimensions of injury** (XV0-XV9): mechanism, intent, substance
- **Medication** (XM0-XM9): associated medications

**Usage:** Always pair with a stem code using the cluster operator "&"
Example: BA00 (Pneumonia) & XS28 (Severe) → BA00&XS28`,

    clustering: `# ICD-11 Code Clustering

Clustering combines multiple codes to represent a clinical concept fully.

**Operator:** "&" (ampersand) joins codes
**Separator:** "/" (slash) separates independent conditions

**Rules:**
1. Stem code comes first
2. Extension codes follow with "&"
3. Only valid pairings per postcoordination axes are allowed
4. Pre-combined codes take precedence when available

**Examples:**
- BA00&XS28 → Severe pneumonia
- 2A00.0&XH3Y48 → Specific neoplasm with histology type
- BA00/CA40 → Pneumonia and asthma (separate conditions)`,

    sequencing: `# ICD Coding Sequencing Rules

**ICD-11 Sequencing:**
1. **Main condition** is coded first (reason for encounter)
2. **Other conditions** follow in order of clinical significance
3. Extension codes follow their stem codes
4. Cluster codes stay together as a unit

**ICD-10 Sequencing:**
1. **Principal diagnosis** coded first
2. **Dagger (†) code** represents underlying disease
3. **Asterisk (*) code** represents the manifestation
4. Report dagger code as principal when both apply

**General Principles:**
- Code to the highest level of specificity available
- Use "unspecified" codes only when information is truly absent
- Avoid "not elsewhere classified" (NEC) when a specific code exists`,

    dagger_asterisk: `# ICD-10 Dagger (†) and Asterisk (*) System

The dual classification system links **etiology** to **manifestation**.

**Dagger (†):** The underlying disease/etiology
**Asterisk (*):** The clinical manifestation

**Rules:**
1. Dagger code is always the principal diagnosis
2. Asterisk code is an optional additional code
3. Both codes should be recorded when applicable
4. Not all codes participate in this system

**Examples:**
- A17.0† G01* → Tuberculous meningitis
  - A17.0† = Tuberculosis of nervous system (etiology)
  - G01* = Meningitis in diseases classified elsewhere (manifestation)

**Note:** ICD-11 replaced this with postcoordination and code clustering.`,

    postcoordination: `# ICD-11 Postcoordination

Postcoordination allows adding detail to a stem code along defined **axes**.

**Available Axes (vary by code):**
- Severity
- Temporality (acute, chronic, etc.)
- Anatomy (specific body site)
- Histopathology
- Causality (infectious agent, substance)
- Medication
- Injury dimensions (mechanism, intent, place)

**How to check:** Use {"action": "lookup", "code": "..."} — the entity data includes allowed postcoordination axes.

**Syntax:** stem_code & extension_code [& extension_code ...]

**Pre- vs Post-coordination:**
- **Pre-coordinated:** BA00.1 (already specific in the classification)
- **Post-coordinated:** BA00&XS28 (combining stem + extension)
- Always prefer pre-coordinated codes when they exist`,
  };

  if (topic) {
    const key = topic.toLowerCase().replace(/[\s-]/g, "_");
    const content = topics[key];
    if (content) {
      return { content: [{ type: "text", text: content }] };
    }

    return {
      content: [
        {
          type: "text",
          text: `Unknown topic: "${topic}"\n\n**Available topics:** ${Object.keys(topics).join(", ")}\n\nUsage: {"action": "coding_rules", "topic": "extension_codes"}`,
        },
      ],
      isError: true,
    };
  }

  // No topic: show overview of all topics
  const lines = [
    "# ICD Coding Rules & Conventions\n",
    "Use the **topic** parameter for detailed rules:\n",
    ...Object.keys(topics).map((t) => `- **${t}**: {"action": "coding_rules", "topic": "${t}"}`),
    "\n**Quick reference:**",
    "- ICD-11 uses extension codes + clustering instead of ICD-10's dagger/asterisk",
    "- Always code to the highest specificity available",
    "- Stem codes can stand alone; extension codes cannot",
  ];

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

function handleOverview(version: string): ToolResult {
  if (version === "10") {
    return {
      content: [
        {
          type: "text",
          text: `# ICD-10 Overview

**International Classification of Diseases, 10th Revision**
Adopted: 1990 | In widespread use since: 1994

## Structure
- **21 chapters** (I-XXII) organized by body system and disease type
- **~14,400 codes** using alphanumeric format (A00.0 - Z99.9)
- **Format:** Letter + 2 digits (category), optional decimal + digit (subcategory)
  - Example: J18.9 = Pneumonia, unspecified

## Key Features
- Dagger/asterisk (†/*) dual classification for etiology + manifestation
- Tabular list with inclusion/exclusion notes
- Alphabetical index for code lookup

## Chapter Range
| Chapters | Range | Topic |
|----------|-------|-------|
| I | A00-B99 | Infectious and parasitic diseases |
| II | C00-D48 | Neoplasms |
| III | D50-D89 | Blood diseases |
| IV | E00-E90 | Endocrine, nutritional, metabolic |
| V | F00-F99 | Mental and behavioural disorders |
| VI | G00-G99 | Nervous system |
| VII | H00-H59 | Eye and adnexa |
| VIII | H60-H95 | Ear and mastoid |
| IX | I00-I99 | Circulatory system |
| X | J00-J99 | Respiratory system |
| XI | K00-K93 | Digestive system |
| XII | L00-L99 | Skin and subcutaneous tissue |
| XIII | M00-M99 | Musculoskeletal and connective tissue |
| XIV | N00-N99 | Genitourinary system |
| XV | O00-O99 | Pregnancy and childbirth |
| XVI | P00-P96 | Perinatal conditions |
| XVII | Q00-Q99 | Congenital malformations |
| XVIII | R00-R99 | Symptoms and signs |
| XIX | S00-T98 | Injury and poisoning |
| XX | V01-Y98 | External causes |
| XXI | Z00-Z99 | Health status and services |

Use {"action": "chapters", "version": "10"} to see chapters with WHO API details.`,
          },
        ],
      };
    }

  return {
    content: [
      {
        type: "text",
        text: `# ICD-11 Overview

**International Classification of Diseases, 11th Revision**
Adopted: 2019 by WHA | In effect: January 2022

## Structure
- **28 chapters** with ~17,000 diagnostic categories
- **Foundation layer:** comprehensive ontology (~80,000 entities)
- **MMS linearization:** Mortality & Morbidity Statistics (the clinical coding version)
- **Format:** Alphanumeric stem codes, e.g., BA00, 1A00.1

## Key Improvements over ICD-10
- **Postcoordination:** Add detail via extension codes (severity, anatomy, etc.)
- **Code clustering:** Combine codes with "&" operator
- **No more dagger/asterisk** — replaced by clustering
- **Better digital integration** — API-first, URIs for every entity
- **Richer content** — definitions, coding notes, synonyms

## Chapter Highlights
| Chapter | Code Range | Topic |
|---------|-----------|-------|
| 01 | 1A00-1H0Z | Infectious or parasitic diseases |
| 02 | 2A00-2F9Z | Neoplasms |
| 05 | 5A00-5D46 | Endocrine, nutritional, metabolic |
| 06 | 6A00-6E8Z | Mental, behavioural, neurodevelopmental |
| 08 | 8A00-8E7Z | Nervous system |
| 11 | BA00-BE2Z | Respiratory system |
| 12 | DA00-DE2Z | Digestive system |
| 21 | RA00-RE0Z | Symptoms or signs |
| 22 | NA00-NF2Z | Injury, poisoning, external causes |
| 26 | XA00-XY9Z | Extension codes |
| V | - | Traditional medicine (supplementary) |
| X | - | Extension codes (supplementary) |

## New to ICD-11
- **Autocode:** {"action": "autocode", "query": "clinical text here"}
- **Extension codes:** {"action": "coding_rules", "topic": "extension_codes"}
- **Browse hierarchy:** {"action": "browse"}

Use {"action": "chapters"} to see all chapters from the WHO API.`,
      },
    ],
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
  {"action": "lookup", "code": "A00"}
  {"action": "lookup", "code": "J18.9", "version": "10"}

**search** - Find codes by keyword (ICD-11 only)
  {"action": "search", "query": "pneumonia"}
  {"action": "search", "query": "diabetes", "chapter": "05"}

**autocode** - Clinical text → ICD-11 code (ICD-11 only)
  {"action": "autocode", "query": "acute bronchitis"}
  {"action": "autocode", "query": "patient presents with chest pain and shortness of breath"}

**browse** - Navigate classification hierarchy
  {"action": "browse"}                              (shows chapters)
  {"action": "browse", "code": "BA00"}              (shows code + children)

**chapters** - List all chapters
  {"action": "chapters"}
  {"action": "chapters", "version": "10"}

**children** - Get subcodes
  {"action": "children", "code": "BA00"}

**ancestors** - Walk up hierarchy to chapter
  {"action": "ancestors", "code": "BA01.0"}
  {"action": "ancestors", "code": "J18.9", "version": "10"}

**validate** - Check if a code is valid
  {"action": "validate", "code": "BA00"}
  {"action": "validate", "code": "Z99", "version": "10"}

**coding_rules** - ICD coding conventions
  {"action": "coding_rules"}                        (list topics)
  {"action": "coding_rules", "topic": "extension_codes"}
  {"action": "coding_rules", "topic": "clustering"}
  {"action": "coding_rules", "topic": "sequencing"}
  {"action": "coding_rules", "topic": "dagger_asterisk"}
  {"action": "coding_rules", "topic": "postcoordination"}

**overview** - Classification summary
  {"action": "overview"}                            (ICD-11 default)
  {"action": "overview", "version": "10"}

**api** - Raw WHO API request
  {"action": "api", "path": "/icd/release/11/2024-01/mms"}

## ICD-10 vs ICD-11

| Feature | ICD-10 | ICD-11 |
|---------|--------|--------|
| Lookup | Yes | Yes |
| Search | No* | Yes |
| Autocode | No | Yes |
| Browse | Yes | Yes |
| Chapters | Yes | Yes |
| Children | Yes | Yes |
| Ancestors | Yes | Yes |
| Validate | Yes | Yes |
| Coding Rules | Yes | Yes |
| Overview | Yes | Yes |

*ICD-10 search not supported by WHO API

## More Info
- ICD-10: https://icd.who.int/browse10
- ICD-11: https://icd.who.int/browse11`,
      },
    ],
  };
}
