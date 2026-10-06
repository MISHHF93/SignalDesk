/**
 * @signaldesk/mcp-registry-client
 * Discovery and installation client for certified MCP server packages.
 */

export interface RegistryPackage {
  id: string;
  name: string;
  provider: string;
  category: string;
  trustTier: string;
  version: string;
  description: string;
  capabilityClasses: string[];
  resources: string[];
  tools: string[];
}

export class SignalDeskMCPRegistryClient {
  private registryUrl: string;

  constructor(registryUrl: string = 'https://registry.signaldesk.internal/api/mcp/registry') {
    this.registryUrl = registryUrl;
  }

  async searchPackages(query?: string, category?: string): Promise<RegistryPackage[]> {
    try {
      const url = new URL(this.registryUrl);
      if (query) url.searchParams.set('q', query);
      if (category) url.searchParams.set('category', category);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Registry request failed: ${res.statusText}`);
      const data = await res.json();
      return data.packages || [];
    } catch {
      // Fallback to local default certified packages
      return [];
    }
  }
}
