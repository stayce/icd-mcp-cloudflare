/**
 * ICD MCP Server - WHO ICD-API Client
 *
 * Handles authentication and API calls to WHO ICD-API for ICD-10 and ICD-11.
 * API Documentation: https://icd.who.int/docs/icd-api/APIDoc-Version2/
 */

import { WHOClientConfig, ICDEntity, ICDSearchResult, ICDChapter } from "./types";

const TOKEN_ENDPOINT = "https://icdaccessmanagement.who.int/connect/token";
const API_BASE_URL = "https://id.who.int";

export class WHOICDClient {
  private clientId: string;
  private clientSecret: string;
  private icd10Release: string;
  private icd11Release: string;
  private language: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: WHOClientConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.icd10Release = config.icd10Release || "2019";
    this.icd11Release = config.icd11Release || "2024-01";
    this.language = config.language || "en";
  }

  /**
   * Authenticate with WHO ICD-API using OAuth2 client credentials
   */
  private async authenticate(): Promise<void> {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: "icdapi_access",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Authentication failed: ${response.status} - ${text}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureToken(): Promise<string> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
    return this.accessToken!;
  }

  /**
   * Make an authenticated API request
   */
  async apiRequest<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const token = await this.ensureToken();

    let url = `${API_BASE_URL}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Accept-Language": this.language,
        "API-Version": "v2",
      },
    });

    if (response.status === 401) {
      this.accessToken = null;
      return this.apiRequest(endpoint, params);
    }

    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API request failed: ${response.status} - ${text}`);
    }

    return response.json() as Promise<T>;
  }

  // ==================== ICD-10 Methods ====================

  /**
   * Get ICD-10 code details
   */
  async getICD10Code(code: string): Promise<ICDEntity | null> {
    try {
      const data = await this.apiRequest<Record<string, unknown>>(
        `/icd/release/10/${this.icd10Release}/${code}`
      );
      return this.parseEntity(data);
    } catch (error) {
      console.warn(`Failed to get ICD-10 code ${code}:`, error);
      return null;
    }
  }

  /**
   * Get ICD-10 chapters
   */
  async getICD10Chapters(): Promise<ICDChapter[]> {
    const data = await this.apiRequest<{ child?: string[] }>(
      `/icd/release/10/${this.icd10Release}`
    );

    const chapters: ICDChapter[] = [];
    if (data.child) {
      for (const uri of data.child) {
        try {
          const chapterData = await this.getEntityByUri(uri);
          if (chapterData) {
            chapters.push({
              code: chapterData.code,
              title: chapterData.title,
              uri: uri,
            });
          }
        } catch {
          // Skip failed chapter fetches
        }
      }
    }
    return chapters;
  }

  /**
   * Get children of an ICD-10 code
   */
  async getICD10Children(code: string): Promise<ICDEntity[]> {
    const entity = await this.getICD10Code(code);
    if (!entity || !entity.children) {
      return [];
    }

    const children: ICDEntity[] = [];
    for (const childUri of entity.children.slice(0, 20)) {
      const child = await this.getEntityByUri(childUri);
      if (child) {
        children.push(child);
      }
    }
    return children;
  }

  // ==================== ICD-11 Methods ====================

  /**
   * Get ICD-11 code details using codeinfo endpoint
   */
  async getICD11Code(code: string): Promise<ICDEntity | null> {
    try {
      // Use codeinfo to get the stemId
      const codeinfo = await this.apiRequest<{ stemId?: string }>(
        `/icd/release/11/${this.icd11Release}/mms/codeinfo/${code}`
      );

      if (!codeinfo.stemId) {
        return null;
      }

      return this.getEntityByUri(codeinfo.stemId);
    } catch (error) {
      console.warn(`Failed to get ICD-11 code ${code}:`, error);
      return null;
    }
  }

  /**
   * Search ICD-11 codes
   */
  async searchICD11(query: string, maxResults: number = 10, chapterFilter?: string): Promise<ICDSearchResult[]> {
    const params: Record<string, string> = {
      q: query,
      useFlexisearch: "true",
      flatResults: "true",
      highlightingEnabled: "false",
    };

    if (chapterFilter) {
      params.chapterFilter = chapterFilter;
    }

    const data = await this.apiRequest<{
      destinationEntities?: Array<{
        theCode?: string;
        title?: string;
        score?: number;
        id?: string;
        chapter?: string;
      }>;
    }>(`/icd/release/11/${this.icd11Release}/mms/search`, params);

    const results: ICDSearchResult[] = [];
    const entities = data.destinationEntities || [];

    for (const item of entities.slice(0, maxResults)) {
      results.push({
        code: item.theCode || "",
        title: item.title || "",
        score: item.score,
        uri: item.id || "",
        chapter: item.chapter,
      });
    }

    return results;
  }

  /**
   * Get ICD-11 chapters
   */
  async getICD11Chapters(): Promise<ICDChapter[]> {
    const data = await this.apiRequest<{ child?: string[] }>(
      `/icd/release/11/${this.icd11Release}/mms`
    );

    const chapters: ICDChapter[] = [];
    if (data.child) {
      for (const uri of data.child) {
        try {
          const chapterData = await this.getEntityByUri(uri);
          if (chapterData) {
            chapters.push({
              code: chapterData.code,
              title: chapterData.title,
              uri: uri,
            });
          }
        } catch {
          // Skip failed chapter fetches
        }
      }
    }
    return chapters;
  }

  /**
   * Get children of an ICD-11 code
   */
  async getICD11Children(code: string): Promise<ICDEntity[]> {
    const entity = await this.getICD11Code(code);
    if (!entity || !entity.children) {
      return [];
    }

    const children: ICDEntity[] = [];
    for (const childUri of entity.children.slice(0, 20)) {
      const child = await this.getEntityByUri(childUri);
      if (child) {
        children.push(child);
      }
    }
    return children;
  }

  // ==================== Common Methods ====================

  /**
   * Get entity by URI
   */
  async getEntityByUri(uri: string): Promise<ICDEntity | null> {
    let cleanUri = uri;
    if (cleanUri.startsWith("http://")) {
      cleanUri = cleanUri.replace("http://", "https://");
    }

    const endpoint = cleanUri.replace(API_BASE_URL, "");

    try {
      const data = await this.apiRequest<Record<string, unknown>>(endpoint);
      return this.parseEntity(data);
    } catch (error) {
      console.warn(`Failed to get entity by URI ${uri}:`, error);
      return null;
    }
  }

  /**
   * Parse API response into ICDEntity
   */
  private parseEntity(data: Record<string, unknown>): ICDEntity {
    // Extract code
    const code = (data.code as string) || (data.theCode as string) || (data.codeRange as string) || "";

    // Get title
    let title = data.title;
    if (typeof title === "object" && title !== null) {
      title = (title as Record<string, unknown>)["@value"] || JSON.stringify(title);
    }

    // Get definition
    let definition = data.definition;
    if (typeof definition === "object" && definition !== null) {
      definition = (definition as Record<string, unknown>)["@value"];
    }

    // Get long definition
    let longDefinition = data.longDefinition;
    if (typeof longDefinition === "object" && longDefinition !== null) {
      longDefinition = (longDefinition as Record<string, unknown>)["@value"];
    }

    // Get inclusions
    let inclusions: string[] | undefined;
    const inclusionData = data.inclusion || data.indexTerm;
    if (Array.isArray(inclusionData)) {
      inclusions = inclusionData.map((i: unknown) => {
        if (typeof i === "object" && i !== null) {
          const label = (i as Record<string, unknown>).label;
          if (typeof label === "object" && label !== null) {
            return (label as Record<string, unknown>)["@value"] as string || JSON.stringify(i);
          }
          return (i as Record<string, unknown>).label as string || JSON.stringify(i);
        }
        return String(i);
      });
    }

    // Get exclusions
    let exclusions: string[] | undefined;
    if (Array.isArray(data.exclusion)) {
      exclusions = data.exclusion.map((e: unknown) => {
        if (typeof e === "object" && e !== null) {
          const label = (e as Record<string, unknown>).label;
          if (typeof label === "object" && label !== null) {
            return (label as Record<string, unknown>)["@value"] as string || JSON.stringify(e);
          }
          return (e as Record<string, unknown>).label as string || JSON.stringify(e);
        }
        return String(e);
      });
    }

    // Get coding note
    let codingNote = data.codingNote;
    if (typeof codingNote === "object" && codingNote !== null) {
      codingNote = (codingNote as Record<string, unknown>)["@value"];
    }

    // Get parent
    let parent: string | undefined;
    if (Array.isArray(data.parent) && data.parent.length > 0) {
      parent = data.parent[0] as string;
    } else if (typeof data.parent === "string") {
      parent = data.parent;
    }

    // Get children
    let children: string[] | undefined;
    if (Array.isArray(data.child)) {
      children = data.child as string[];
    } else if (typeof data.child === "string") {
      children = [data.child];
    }

    // Get browser URL
    const browserUrl = data.browserUrl as string | undefined;

    return {
      code,
      title: String(title || ""),
      definition: definition ? String(definition) : undefined,
      longDefinition: longDefinition ? String(longDefinition) : undefined,
      inclusions,
      exclusions,
      codingNote: codingNote ? String(codingNote) : undefined,
      parent,
      children,
      uri: (data["@id"] as string) || (data.id as string) || undefined,
      classKind: data.classKind as string | undefined,
      browserUrl,
    };
  }
}
