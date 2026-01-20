# ICD MCP Server (Cloudflare Workers)

A Model Context Protocol (MCP) server for the **WHO ICD-10 and ICD-11** classification systems, deployed on Cloudflare Workers.

**Live URL:** `https://icd-mcp-server.staycek.workers.dev/mcp`

## Features

- **ICD-10** and **ICD-11** support via official WHO ICD-API
- Single tool with 6 actions (token efficient)
- Global edge deployment on Cloudflare Workers
- Same credentials as ICF MCP Server

## Actions

| Action | Purpose | ICD-10 | ICD-11 |
|--------|---------|--------|--------|
| `lookup` | Get code details | Yes | Yes |
| `search` | Find codes by keyword | No* | Yes |
| `chapters` | List chapters | Yes | Yes |
| `children` | Get subcodes | Yes | Yes |
| `api` | Raw WHO API | Yes | Yes |
| `help` | Documentation | Yes | Yes |

*ICD-10 search not supported by WHO API

## Usage with Claude

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "icd": {
      "type": "url",
      "url": "https://icd-mcp-server.staycek.workers.dev/mcp"
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
{"action": "chapters"}
{"action": "chapters", "version": "10"}
{"action": "children", "code": "BA00"}
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
