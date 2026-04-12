# ICD MCP Server

Give any AI assistant instant access to the **WHO ICD-10 and ICD-11** classification systems — the global standard behind every diagnosis code, hospital bill, and mortality statistic on earth.

**12 actions. Both ICD versions. One tool call.**

[![CI](https://github.com/stayce/icd-mcp-cloudflare/actions/workflows/ci.yml/badge.svg)](https://github.com/stayce/icd-mcp-cloudflare/actions/workflows/ci.yml)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

```
https://mcp-icd.medseal.app/mcp
```

---

## What Can It Do?

### Autocode clinical text into ICD-11 codes

Paste free-text clinical descriptions and get the right code back. No more manual lookups.

```json
{"action": "autocode", "query": "acute bronchitis with fever"}
→ CA20 Acute bronchitis (92.3% confidence)

{"action": "autocode", "query": "patient presents with chest pain and shortness of breath"}
→ MD81 Chest pain (87.1% confidence)
```

### Look up any ICD-10 or ICD-11 code instantly

Get definitions, coding notes, inclusions, exclusions — everything a coder needs.

```json
{"action": "lookup", "code": "BA00"}
→ BA00: Lobar pneumonia — full definition, coding notes, inclusions/exclusions

{"action": "lookup", "code": "J18.9", "version": "10"}
→ J18.9: Pneumonia, unspecified (ICD-10)
```

### Search by keyword

Don't know the code? Describe it and get ranked results.

```json
{"action": "search", "query": "type 2 diabetes with kidney complications"}
→ Ranked ICD-11 results with codes and titles

{"action": "search", "query": "melanoma", "chapter": "02", "max_results": 5}
→ Filtered to neoplasm chapter
```

### Browse the classification like a tree

Navigate interactively — see any code's parent, children, and where it sits in the hierarchy.

```json
{"action": "browse"}
→ All 28 ICD-11 chapters (or 21 ICD-10 chapters)

{"action": "browse", "code": "BA00"}
→ Parent context + sub-categories with ▸ expansion markers
```

### Trace a code's full lineage

Walk from any leaf code all the way up to its chapter root.

```json
{"action": "ancestors", "code": "BA01.0"}
→ BA01.0 → BA01 → BA0Y-BA2Z → Diseases of the respiratory system → Chapter 12
```

### Validate codes instantly

Quick yes/no — is this a real code? Is it a leaf or a category?

```json
{"action": "validate", "code": "BA00"}
→ Valid ICD-11 code, category level, has sub-codes

{"action": "validate", "code": "XYZ99"}
→ Not a valid ICD-11 code
```

### Built-in coding rules reference

No need to leave the conversation for coding guidelines.

```json
{"action": "coding_rules", "topic": "extension_codes"}
→ Full guide to ICD-11 severity, temporality, anatomy, histopathology codes

{"action": "coding_rules", "topic": "clustering"}
→ How to combine codes with & and / operators

{"action": "coding_rules", "topic": "dagger_asterisk"}
→ ICD-10 etiology/manifestation dual coding system
```

Available topics: `extension_codes`, `clustering`, `sequencing`, `dagger_asterisk`, `postcoordination`

### Get the big picture

High-level summaries of each classification system — chapter tables, key concepts, what's different.

```json
{"action": "overview"}
→ ICD-11: 28 chapters, postcoordination, extension codes, what changed from ICD-10

{"action": "overview", "version": "10"}
→ ICD-10: 21 chapters, code ranges, dagger/asterisk system
```

---

## All 12 Actions at a Glance

| Action | What it does | ICD-10 | ICD-11 |
|--------|-------------|--------|--------|
| `lookup` | Full code details with definitions | Yes | Yes |
| `search` | Find codes by keyword | - | Yes |
| `autocode` | Clinical text → best matching code | - | Yes |
| `browse` | Navigate the hierarchy interactively | Yes | Yes |
| `chapters` | List all classification chapters | Yes | Yes |
| `children` | Get sub-codes under any code | Yes | Yes |
| `ancestors` | Trace lineage up to chapter root | Yes | Yes |
| `validate` | Check if a code exists and its level | Yes | Yes |
| `coding_rules` | Coding conventions reference | Yes | Yes |
| `overview` | Classification system summary | Yes | Yes |
| `api` | Raw WHO API access | Yes | Yes |
| `help` | Action reference and examples | - | - |

---

## Who Is This For?

- **Health IT developers** building clinical apps, EHRs, or coding tools
- **Medical coders** who want AI-assisted code lookup and validation
- **Health data analysts** exploring classification structures
- **Researchers** working with WHO mortality/morbidity data
- **AI/LLM builders** adding medical coding capabilities to agents
- **Anyone transitioning from ICD-10 to ICD-11** and needing both systems side by side

---

## Quick Start

### Use the hosted server (fastest)

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "icd": {
      "type": "url",
      "url": "https://mcp-icd.medseal.app/mcp"
    }
  }
}
```

Or connect from any MCP-compatible client using `https://mcp-icd.medseal.app/mcp`.

### Deploy your own

1. **Clone and install:**
   ```bash
   git clone https://github.com/stayce/icd-mcp-cloudflare
   cd icd-mcp-cloudflare
   npm install
   ```

2. **Get WHO API credentials** (free):
   - Register at https://icd.who.int/icdapi
   - Get your Client ID and Secret

3. **Set secrets and deploy:**
   ```bash
   wrangler secret put WHO_CLIENT_ID
   wrangler secret put WHO_CLIENT_SECRET
   npm run deploy
   ```

That's it. Runs globally on Cloudflare's edge network.

---

## Why This MCP?

**Token efficient.** One tool, 12 actions. No bloated tool lists eating context windows.

**Both ICD versions.** ICD-10 is still used for billing everywhere. ICD-11 is the future. You need both. Default is ICD-11; add `"version": "10"` for ICD-10.

**Official WHO data.** Direct from the WHO ICD-API — not a stale copy or a scraped dataset.

**Autocode is the real deal.** The WHO's own autocoding engine, not a keyword hack. Give it clinical text, get the right code.

**Zero cold starts.** Cloudflare Workers, not a container. Sub-50ms globally.

---

## ICD-10 vs ICD-11

| | ICD-10 | ICD-11 |
|---|--------|--------|
| **Adopted** | 1990 | 2019 |
| **Codes** | ~14,400 | ~17,000 |
| **Format** | A00.0–Z99.9 | BA00, 1A00.1 |
| **Search** | Not supported by WHO API | Full-text + flexisearch |
| **Autocoding** | Not available | Yes |
| **Key feature** | Dagger/asterisk dual coding | Postcoordination + extension codes |
| **Status** | Still dominant in billing | Officially in effect since Jan 2022 |

This server defaults to ICD-11 but fully supports both. Use `"version": "10"` for ICD-10 queries.

---

## Part of the MedSeal MCP Suite

| Server | Classification | Link |
|--------|---------------|------|
| **ICD MCP** (this) | WHO ICD-10/ICD-11 diagnosis codes | [icd-mcp-cloudflare](https://github.com/stayce/icd-mcp-cloudflare) |
| **ICF MCP** | WHO ICF functioning & disability | [icf-mcp-cloudflare](https://github.com/stayce/icf-mcp-cloudflare) |
| **Part D MCP** | CMS Medicare Part D drug spending | [partd-mcp-cloudflare](https://github.com/stayce/partd-mcp-cloudflare) |

All deployed on Cloudflare Workers. All open source. All MCP-compatible.

---

## License

MIT
