/**
 * @signaldesk/mcp-sdk
 * Official client SDK for connecting Claude, Gemini, Cursor, or external agents
 * to SignalDesk's 2026 Model Context Protocol (MCP) server.
 */

export interface MCPClientOptions {
  baseUrl: string;
  authToken?: string;
  tenantId?: string;
  timeoutMs?: number;
}

export interface MCPToolCallResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  traceId?: string;
  verificationProof?: string;
}

export class SignalDeskMCPClient {
  private baseUrl: string;
  private authToken?: string;
  private tenantId?: string;
  private timeoutMs: number;

  constructor(options: MCPClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.authToken = options.authToken;
    this.tenantId = options.tenantId;
    this.timeoutMs = options.timeoutMs || 30000;
  }

  private async rpcCall(method: string, params?: any): Promise<any> {
    const id = `sd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    if (this.tenantId) {
      headers['X-Tenant-ID'] = this.tenantId;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          method,
          params
        }),
        signal: controller.signal
      });

      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`MCP RPC call failed: HTTP ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      if (json.error) {
        throw new Error(`MCP Error [${json.error.code}]: ${json.error.message}`);
      }

      return json.result;
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * Handshake & initialize connection with SignalDesk MCP server
   */
  async initialize(): Promise<{
    protocolVersion: string;
    serverInfo: { name: string; version: string };
    capabilities: any;
  }> {
    return this.rpcCall('initialize', {
      clientInfo: {
        name: 'signaldesk-mcp-sdk',
        version: '1.0.0'
      },
      protocolVersion: '2026-07-28'
    });
  }

  /**
   * List all available governed business tools
   */
  async listTools(): Promise<Array<{ name: string; description: string; inputSchema: any }>> {
    const res = await this.rpcCall('tools/list');
    return res.tools || [];
  }

  /**
   * Call a governed business tool
   */
  async callTool<T = any>(name: string, args: Record<string, any> = {}): Promise<MCPToolCallResult<T>> {
    try {
      const res = await this.rpcCall('tools/call', {
        name,
        arguments: args
      });
      return {
        success: true,
        data: res.content as T,
        traceId: res.traceId,
        verificationProof: res.verificationProof
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Unknown MCP tool invocation error'
      };
    }
  }

  /**
   * Convenience helpers for prominent SignalDesk business capabilities
   */
  async getBusinessPulse() {
    return this.callTool('get_business_pulse');
  }

  async getAttentionItems(minMateriality?: 'P1' | 'P2' | 'P3') {
    return this.callTool('get_attention_items', { minMateriality });
  }

  async searchBusiness(query: string) {
    return this.callTool('search_business', { query });
  }

  async getCustomerContext(customerName: string) {
    return this.callTool('get_customer_context', { customerName });
  }

  async createMission(title: string, objective: string, priority: 'P1' | 'P2' | 'P3' = 'P1') {
    return this.callTool('create_mission', { title, objective, priority });
  }

  async verifyOutcome(auditRecordId: string) {
    return this.callTool('verify_outcome', { auditRecordId });
  }
}
