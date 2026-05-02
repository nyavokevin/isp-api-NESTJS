import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RouterOSAPI } from 'node-routeros';

@Injectable()
export class RouterOSService implements OnModuleDestroy {
  private readonly logger = new Logger(RouterOSService.name);
  private client: RouterOSAPI | null = null;
  private connected = false;

  constructor(private config: ConfigService) {}

  private async getClient(): Promise<RouterOSAPI> {
    if (this.client && this.connected) return this.client;

    const host = this.config.get('ROUTEROS_HOST', '192.168.88.1');
    const user = this.config.get('ROUTEROS_USER', 'admin');
    const password = this.config.get('ROUTEROS_PASSWORD', '');
    const port = parseInt(this.config.get('ROUTEROS_PORT', '8728'));
    const timeout = parseInt(this.config.get('ROUTEROS_TIMEOUT', '10000'));

    this.client = new RouterOSAPI({
      host,
      user,
      password,
      port,
      timeout,
    });

    try {
      await this.client.connect();
      this.connected = true;
      this.logger.log(`Connected to RouterOS at ${host}`);

      this.client.on('close', () => {
        this.connected = false;
        this.client = null;
        this.logger.warn('RouterOS connection closed');
      });

      this.client.on('error', (err) => {
        this.connected = false;
        this.client = null;
        this.logger.error('RouterOS error:', err.message);
      });

      return this.client;
    } catch (err: any) {
      this.connected = false;
      this.client = null;
      throw new Error(`Cannot connect to RouterOS: ${err.message}`);
    }
  }

  async execute(command: string, params: Record<string, string> = {}): Promise<any[]> {
    const client = await this.getClient();
    try {
      const result = await (client as any).write(command, params);
      return result;
    } catch (err: any) {
      this.connected = false;
      this.client = null;
      throw new Error(`RouterOS command failed [${command}]: ${err.message}`);
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.execute('/system/identity/print');
      return true;
    } catch {
      return false;
    }
  }

  // ─── PPPoE Secrets (clients) ──────────────────────────────────────────────

  async getPPPoESecrets(): Promise<any[]> {
    return this.execute('/ppp/secret/print');
  }

  async getPPPoESecretByName(name: string): Promise<any> {
    const results = await this.execute('/ppp/secret/print', { '?name': name });
    return results[0] || null;
  }

  async createPPPoESecret(data: {
    name: string;
    password: string;
    profile: string;
    comment?: string;
    'remote-address'?: string;
  }): Promise<any> {
    const params: Record<string, string> = {
      name: data.name,
      password: data.password,
      profile: data.profile,
      service: 'pppoe',
    };
    if (data.comment) params.comment = data.comment;
    if (data['remote-address']) params['remote-address'] = data['remote-address'];

    return this.execute('/ppp/secret/add', params);
  }

  async updatePPPoESecret(id: string, data: Partial<{
    password: string;
    profile: string;
    comment: string;
    disabled: boolean;
  }>): Promise<any> {
    const params: Record<string, string> = { '.id': id };
    if (data.password !== undefined) params.password = data.password;
    if (data.profile !== undefined) params.profile = data.profile;
    if (data.comment !== undefined) params.comment = data.comment;
    if (data.disabled !== undefined) params.disabled = data.disabled ? 'yes' : 'no';
    return this.execute('/ppp/secret/set', params);
  }

  async deletePPPoESecret(id: string): Promise<void> {
    await this.execute('/ppp/secret/remove', { '.id': id });
  }

  async enablePPPoESecret(id: string): Promise<void> {
    await this.execute('/ppp/secret/enable', { '.id': id });
  }

  async disablePPPoESecret(id: string): Promise<void> {
    await this.execute('/ppp/secret/disable', { '.id': id });
  }

  // ─── PPPoE Active Sessions ────────────────────────────────────────────────

  async getActivePPPoESessions(): Promise<any[]> {
    return this.execute('/ppp/active/print');
  }

  async disconnectPPPoESession(id: string): Promise<void> {
    await this.execute('/ppp/active/remove', { '.id': id });
  }

  // ─── PPPoE Profiles ──────────────────────────────────────────────────────

  async getPPPoEProfiles(): Promise<any[]> {
    return this.execute('/ppp/profile/print');
  }

  async getPPPoEProfileByName(name: string): Promise<any> {
    const results = await this.execute('/ppp/profile/print', { '?name': name });
    return results[0] || null;
  }

  async createPPPoEProfile(data: {
    name: string;
    'rate-limit'?: string;
    'local-address'?: string;
    'remote-address'?: string;
    'session-timeout'?: string;
    comment?: string;
  }): Promise<any> {
    const params: Record<string, string> = { name: data.name };
    if (data['rate-limit']) params['rate-limit'] = data['rate-limit'];
    if (data['local-address']) params['local-address'] = data['local-address'];
    if (data['remote-address']) params['remote-address'] = data['remote-address'];
    if (data['session-timeout']) params['session-timeout'] = data['session-timeout'];
    if (data.comment) params.comment = data.comment;
    return this.execute('/ppp/profile/add', params);
  }

  async updatePPPoEProfile(id: string, data: Partial<{
    name: string;
    'rate-limit': string;
    comment: string;
  }>): Promise<any> {
    const params: Record<string, string> = { '.id': id };
    if (data.name) params.name = data.name;
    if (data['rate-limit']) params['rate-limit'] = data['rate-limit'];
    if (data.comment) params.comment = data.comment;
    return this.execute('/ppp/profile/set', params);
  }

  async deletePPPoEProfile(id: string): Promise<void> {
    await this.execute('/ppp/profile/remove', { '.id': id });
  }

  // ─── Interface Traffic ────────────────────────────────────────────────────

  async getInterfaceTraffic(interfaceName?: string): Promise<any[]> {
    const params: Record<string, string> = {};
    if (interfaceName) params['?name'] = interfaceName;
    return this.execute('/interface/print', params);
  }

  async getInterfaceStats(): Promise<any[]> {
    return this.execute('/interface/monitor-traffic', {
      interface: 'ether1',
      once: '',
    });
  }

  // ─── System Resources ─────────────────────────────────────────────────────

  async getSystemResources(): Promise<any> {
    const result = await this.execute('/system/resource/print');
    return result[0] || {};
  }

  async getSystemIdentity(): Promise<any> {
    const result = await this.execute('/system/identity/print');
    return result[0] || {};
  }

  async getSystemRouterboard(): Promise<any> {
    const result = await this.execute('/system/routerboard/print');
    return result[0] || {};
  }

  // ─── IP Addresses ─────────────────────────────────────────────────────────

  async getIPAddresses(): Promise<any[]> {
    return this.execute('/ip/address/print');
  }

  async getIPPool(): Promise<any[]> {
    return this.execute('/ip/pool/print');
  }

  // ─── DHCP Leases ─────────────────────────────────────────────────────────

  async getDHCPLeases(): Promise<any[]> {
    return this.execute('/ip/dhcp-server/lease/print');
  }

  // ─── Ping ─────────────────────────────────────────────────────────────────

  async ping(address: string, count = 4): Promise<any[]> {
    return this.execute('/ping', {
      address,
      count: count.toString(),
    });
  }

  // ─── Logs ─────────────────────────────────────────────────────────────────

  async getLogs(limit = 50): Promise<any[]> {
    const logs = await this.execute('/log/print');
    return logs.slice(0, limit);
  }

  // ─── Queue (Bandwidth limits) ─────────────────────────────────────────────

  async getSimpleQueues(): Promise<any[]> {
    return this.execute('/queue/simple/print');
  }

  async createSimpleQueue(data: {
    name: string;
    target: string;
    'max-limit': string;
    comment?: string;
  }): Promise<any> {
    const params: Record<string, string> = {
      name: data.name,
      target: data.target,
      'max-limit': data['max-limit'],
    };
    if (data.comment) params.comment = data.comment;
    return this.execute('/queue/simple/add', params);
  }

  onModuleDestroy() {
    if (this.client && this.connected) {
      try {
        this.client.close();
      } catch {}
      this.connected = false;
      this.client = null;
      this.logger.log('RouterOS connection closed on module destroy');
    }
  }
}
