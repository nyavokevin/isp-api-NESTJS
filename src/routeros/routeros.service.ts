import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RouterOSClient } from 'routeros-api';

type RouterOSSession = {
  menu: (path: string) => any;
};

@Injectable()
export class RouterOSService implements OnModuleDestroy {
  private readonly logger = new Logger(RouterOSService.name);
  private api: RouterOSClient | null = null;
  private client: RouterOSSession | null = null;
  private connected = false;

  constructor(private config: ConfigService) {}

  private getCommandTimeout() {
    return parseInt(this.config.get('ROUTEROS_TIMEOUT', '10000'));
  }

  private async withCommandTimeout<T>(operation: Promise<T>, command: string): Promise<T> {
    const timeout = this.getCommandTimeout();

    return Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`RouterOS command timed out [${command}] after ${timeout}ms`));
        }, timeout);
      }),
    ]);
  }

  private async getClient(): Promise<RouterOSSession> {
    if (this.client && this.connected) return this.client;

    const isRouterConfigured =
      typeof process.env.ROUTEROS_HOST !== 'undefined' &&
      typeof process.env.ROUTEROS_USER !== 'undefined';

    if (!isRouterConfigured) {
      throw new Error('RouterOS is not configured. Set ROUTEROS_HOST and ROUTEROS_USER in .env.');
    }

    const host = this.config.get('ROUTEROS_HOST', '192.168.88.1');
    const user = this.config.get('ROUTEROS_USER', 'admin');
    const password = this.config.get('ROUTEROS_PASSWORD') ?? '';
    const port = parseInt(this.config.get('ROUTEROS_PORT', '8728'));
    const timeout = parseInt(this.config.get('ROUTEROS_TIMEOUT', '10000'));

    this.api = new RouterOSClient({
      host,
      user,
      password,
      port,
      timeout,
    });

    try {
      this.client = await this.api.connect();
      this.connected = true;
      this.logger.log(`Connected to RouterOS at ${host}`);

      return this.client;
    } catch (err: any) {
      this.connected = false;
      this.client = null;
      this.api = null;
      throw new Error(`Cannot connect to RouterOS: ${err.message}`);
    }
  }

  private getCommandParts(command: string) {
    const knownActions = new Set(['print', 'add', 'set', 'remove']);
    const parts = command.split('/').filter(Boolean);
    const tail = parts[parts.length - 1];

    if (tail && knownActions.has(tail)) {
      return {
        action: tail,
        menuPath: `/${parts.slice(0, -1).join('/')}`,
      };
    }

    return {
      action: 'print',
      menuPath: command,
    };
  }

  private buildReadFilters(params: Record<string, string>) {
    return Object.fromEntries(
      Object.entries(params)
        .filter(([key]) => key !== '.id')
        .map(([key, value]) => [key.startsWith('?') ? key.slice(1) : key, value]),
    );
  }

  private buildWritePayload(params: Record<string, string>) {
    return Object.fromEntries(
      Object.entries(params).filter(([key]) => key !== '.id' && !key.startsWith('?')),
    );
  }

  private getRouterOsItemId(item: Record<string, any> | null | undefined) {
    return item?.['.id'] || item?.id || item?.['#'] || '';
  }

  private getHotspotUserName(item: Record<string, any> | null | undefined) {
    return String(item?.name || item?.user || '').trim().toLowerCase();
  }

  async execute(command: string, params: Record<string, string> = {}): Promise<any> {
    const client = await this.getClient();

    try {
      const { action, menuPath } = this.getCommandParts(command);
      const menu = client.menu(menuPath);
      const id = params['.id'];

      if (action === 'add') {
        return this.withCommandTimeout(menu.add(this.buildWritePayload(params)), command);
      }

      if (action === 'set') {
        if (!id) {
          throw new Error(`Missing .id for command ${command}`);
        }

        return this.withCommandTimeout(menu.update(this.buildWritePayload(params), id), command);
      }

      if (action === 'remove') {
        if (!id) {
          throw new Error(`Missing .id for command ${command}`);
        }

        return this.withCommandTimeout(menu.remove(id), command);
      }

      const filters = this.buildReadFilters(params);

      if (Object.keys(filters).length > 0) {
        return this.withCommandTimeout(menu.where(filters).get(), command);
      }

      return this.withCommandTimeout(menu.get(), command);
    } catch (err: any) {
      this.connected = false;
      this.client = null;
      this.api = null;
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
    await this.updatePPPoESecret(id, { disabled: false });
  }

  async disablePPPoESecret(id: string): Promise<void> {
    await this.updatePPPoESecret(id, { disabled: true });
  }

  // ─── PPPoE Active Sessions ────────────────────────────────────────────────

  async getActivePPPoESessions(): Promise<any[]> {
    return this.execute('/ppp/active/print');
  }

  async getActiveHotspotSessions(): Promise<any[]> {
    return this.execute('/ip/hotspot/active/print');
  }

  async getHotspotHosts(): Promise<any[]> {
    return this.execute('/ip/hotspot/host/print', { '?authorized': 'true' });
  }

  async getAllHotspotHosts(): Promise<any[]> {
    return this.execute('/ip/hotspot/host/print');
  }

  async getHotspotHostByMacAddress(macAddress: string): Promise<any> {
    const normalized = macAddress.trim().toLowerCase();
    const hosts = await this.getAllHotspotHosts();
    return (
      hosts.find((item) => String(item['mac-address'] || '').trim().toLowerCase() === normalized) ||
      null
    );
  }

  async disconnectPPPoESession(id: string): Promise<void> {
    await this.execute('/ppp/active/remove', { '.id': id });
  }

  async disconnectHotspotSession(id: string): Promise<void> {
    await this.execute('/ip/hotspot/active/remove', { '.id': id });
  }

  async getActiveHotspotSessionById(id: string): Promise<any> {
    const sessions = await this.getActiveHotspotSessions();
    return (
      sessions.find(
        (item, index) =>
          String(item['.id'] || item.id || item['#'] || index) === String(id),
      ) || null
    );
  }

  async disconnectHotspotSessionByMacAddress(macAddress: string): Promise<void> {
    const sessions = await this.getActiveHotspotSessions();
    const session = sessions.find(
      (item) => (item['mac-address'] || item['caller-id'] || '') === macAddress,
    );
    const sessionId = session?.['.id'] || session?.id;

    if (!sessionId) {
      throw new Error(`Hotspot session not found for mac-address ${macAddress}`);
    }

    await this.disconnectHotspotSession(sessionId);
  }

  async getHotspotUserByName(name: string): Promise<any> {
    const normalizedName = name.trim().toLowerCase();
    const allUsers = await this.execute('/ip/hotspot/user/print');
    return allUsers.find((item) => this.getHotspotUserName(item) === normalizedName) || null;
  }

  async createHotspotUser(data: {
    name: string;
    password: string;
    profile?: string;
    'rate-limit'?: string;
    'mac-address'?: string;
    comment?: string;
  }): Promise<any> {
    const params: Record<string, string> = {
      name: data.name,
      password: data.password,
      profile: data.profile || 'default',
    };

    if (data['mac-address']) params['mac-address'] = data['mac-address'];
    if (data.comment) params.comment = data.comment;

    return this.execute('/ip/hotspot/user/add', params);
  }

  async updateHotspotUser(id: string, data: Partial<{
    password: string;
    profile: string;
    'rate-limit': string;
    'mac-address': string;
    comment: string;
  }>): Promise<any> {
    const params: Record<string, string> = { '.id': id };
    if (data.password !== undefined) params.password = data.password;
    if (data.profile !== undefined) params.profile = data.profile;
    if (data['mac-address'] !== undefined) params['mac-address'] = data['mac-address'];
    if (data.comment !== undefined) params.comment = data.comment;
    return this.execute('/ip/hotspot/user/set', params);
  }

  async deleteHotspotUser(id: string): Promise<void> {
    await this.execute('/ip/hotspot/user/remove', { '.id': id });
  }

  async ensureTemporaryHotspotUser(
    ticket: string,
    macAddress?: string,
    profile = 'default',
    rateLimit?: string,
  ): Promise<void> {
    const existingUser = await this.getHotspotUserByName(ticket);
    const existingUserId = this.getRouterOsItemId(existingUser);
    const payload = {
      password: ticket,
      profile,
      ...(macAddress ? { 'mac-address': macAddress } : {}),
      comment: 'Temporary hotspot user created from ticket validation',
    };

    if (existingUserId) {
      await this.updateHotspotUser(existingUserId, payload);
      return;
    }

    try {
      await this.createHotspotUser({
        name: ticket,
        password: ticket,
        profile,
        'mac-address': macAddress,
        comment: payload.comment,
      });
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();

      if (!message.includes('already have user with this name')) {
        throw error;
      }

      const duplicateUser = await this.getHotspotUserByName(ticket);
      const duplicateUserId = this.getRouterOsItemId(duplicateUser);

      if (!duplicateUserId) {
        throw error;
      }

      await this.updateHotspotUser(duplicateUserId, payload);
    }
  }

  async loginHotspotClient(ticket: string, ip: string, macAddress?: string): Promise<any> {
    const client = await this.getClient();

    const words = [
      '/ip/hotspot/active/login',
      `=user=${ticket}`,
      `=password=${ticket}`,
      `=ip=${ip}`,
    ];

    if (macAddress) {
      words.push(`=mac-address=${macAddress}`);
    }

    try {
      return this.withCommandTimeout(
        (client.menu('/ip/hotspot/active') as any).write(words),
        '/ip/hotspot/active/login',
      );
    } catch (err: any) {
      this.connected = false;
      this.client = null;
      this.api = null;
      throw new Error(`RouterOS hotspot login failed: ${err.message}`);
    }
  }

  async getHotspotLoginLink(): Promise<string> {
    const loginHost = this.config.get('ROUTEROS_LOGIN_HOST');
    const routerHost = this.config.get('ROUTEROS_HOST', '192.168.88.1');
    const baseHost = loginHost || routerHost;
    const normalizedBase = /^https?:\/\//i.test(baseHost) ? baseHost : `http://${baseHost}`;
    return `${normalizedBase.replace(/\/$/, '')}/login`;
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

  async getInterfaceStats(interfaceName = 'ether1'): Promise<any[]> {
    return this.execute('/interface/monitor-traffic', {
      interface: interfaceName,
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
    if (this.api && this.connected) {
      try {
        this.api.close();
      } catch {}
      this.connected = false;
      this.client = null;
      this.api = null;
      this.logger.log('RouterOS connection closed on module destroy');
    }
  }
}
