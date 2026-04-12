# ICD MCP Server (Cloudflare Workers)

A Model Context Protocol (MCP) server for the **WHO ICD-10 and ICD-11** classification systems, deployed on Cloudflare Workers.

**Live URL:** `https://mcp-icd.medseal.app/mcp`

## Features

- **ICD-10** and **ICD-11** support via official WHO ICD-API
- Single tool with 12 actions (token efficient)
- **Autocode**: free-text clinical descriptions → ICD-11 codes
- **Browse**: interactive classification hierarchy navigation
- **Ancestors**: walk up from any code to its chapter root
- **Validate**: quick code validity checks
- **Coding rules**: built-in reference for extension codes, clustering, sequencing, and more
- Global edge deployment on Cloudflare Workers
- Same credentials as ICF MCP Server

## Actions

| Action | Purpose | ICD-10 | ICD-11 |
|--------|---------|--------|--------|
| `lookup` | Get code details | Yes | Yes |
| `search` | Find codes by keyword | No* | Yes |
| `autocode` | Clinical text → code | No | Yes |
| `browse` | Navigate hierarchy | Yes | Yes |
| `chapters` | List chapters | Yes | Yes |
| `children` | Get subcodes | Yes | Yes |
| `ancestors` | Walk up to chapter | Yes | Yes |
| `validate` | Check code validity | Yes | Yes |
| `coding_rules` | Coding conventions | Yes | Yes |
| `overview` | Classification summary | Yes | Yes |
| `api` | Raw WHO API | Yes | Yes |
| `help` | Documentation | - | - |

*ICD-10 search not supported by WHO API

## Usage with Claude

Add to your Claude Desktop config:

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

Note: This requires WHO API credentials to be set on the server. For personal use, deploy your own instance.

## Deploy Your Own

1. Clone and install:
   ```bash
   git clone https://github.com/stayce/icd-mcp-cloudflare
   cd icd-mcp-cloudflare
   npm install
   ```

2. Get WHO API credentials (free):
   - Register at https://icd.who.int/icdapi
   - Get your Client ID and Secret

3. Set secrets:
   ```bash
   wrangler secret put WHO_CLIENT_ID
   wrangler secret put WHO_CLIENT_SECRET
   ```

4. Deploy:
   ```bash
   npm run deploy
   ```

## Examples

```json
{"action": "lookup", "code": "BA00"}
{"action": "lookup", "code": "J18.9", "version": "10"}
{"action": "search", "query": "pneumonia"}
{"action": "search", "query": "diabetes", "chapter": "05"}
{"action": "autocode", "query": "acute bronchitis with fever"}
{"action": "autocode", "query": "patient presents with chest pain and shortness of breath"}
{"action": "browse"}
{"action": "browse", "code": "BA00"}
{"action": "chapters"}
{"action": "chapters", "version": "10"}
{"action": "children", "code": "BA00"}
{"action": "ancestors", "code": "BA01.0"}
{"action": "validate", "code": "BA00"}
{"action": "validate", "code": "Z99", "version": "10"}
{"action": "coding_rules"}
{"action": "coding_rules", "topic": "extension_codes"}
{"action": "coding_rules", "topic": "clustering"}
{"action": "overview"}
{"action": "overview", "version": "10"}
{"action": "api", "path": "/icd/release/11/2024-01/mms"}
{"action": "help"}
```

## Related

- [icf-mcp-cloudflare](https://github.com/stayce/icf-mcp-cloudflare) - WHO ICF (Functioning) MCP
- [streamshortcut-cloudflare](https://github.com/stayce/streamshortcut-cloudflare) - Shortcut MCP

## ICD-10 vs ICD-11

- **ICD-10**: In use since 1994, widely adopted for billing
- **ICD-11**: Adopted 2019, in effect since 2022, has richer content and search

This MCP defaults to ICD-11 but supports both. Use `"version": "10"` for ICD-10.

## License

MIT
