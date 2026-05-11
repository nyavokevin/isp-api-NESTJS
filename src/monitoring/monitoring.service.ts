import { Injectable, Logger } from '@nestjs/common';
import { ClientsService } from '../clients/clients.service';
import { DatabaseService } from '../database/database.service';
import { PlansService } from '../plans/plans.service';
import { RouterOSService } from '../routeros/routeros.service';

// Fallback seed data when RouterOS is not available
const SEED_MONITORING = {
  systemHealth: [
    {
      label: 'CPU',
      value: '34',
      unit: '%',
      icon: 'memory',
      trend: 'stable',
      trendIcon: 'trending_flat',
      progress: 34,
    },
    {
      label: 'RAM',
      value: '512',
      unit: 'MB',
      icon: 'storage',
      trend: 'up',
      trendIcon: 'trending_up',
      progress: 62,
    },
    {
      label: 'Uptime',
      value: '14j 6h',
      unit: '',
      icon: 'schedule',
      trend: 'stable',
      trendIcon: 'trending_flat',
      progress: 100,
    },
    {
      label: 'Température',
      value: '42',
      unit: '°C',
      icon: 'thermostat',
      trend: 'stable',
      trendIcon: 'trending_flat',
      progress: 42,
    },
  ],
  equipments: [
    { name: 'MikroTik CCR1036', ip: '192.168.88.1', latency: '1ms', status: 'online' },
    { name: 'Switch Backbone', ip: '192.168.1.2', latency: '2ms', status: 'online' },
    { name: 'OLT Fibre', ip: '192.168.1.10', latency: '3ms', status: 'online' },
    { name: 'AP Zone Nord', ip: '192.168.2.1', latency: '8ms', status: 'warning' },
  ],
  alerts: [
    {
      title: 'Pic de trafic détecté',
      time: 'Il y a 5 min',
      description: 'Interface ether1 > 80% capacité',
      severity: 'warning',
    },
    {
      title: 'PPPoE session expirée',
      time: 'Il y a 15 min',
      description: 'Session soa.andriantsoa terminée',
      severity: 'info',
    },
    {
      title: 'Latence élevée Zone Nord',
      time: 'Il y a 1h',
      description: 'AP Zone Nord latence > 20ms',
      severity: 'warning',
    },
  ],
  trafficChart: generateTrafficData(),
};

function generateTrafficData() {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const h = new Date(now.getTime() - i * 3600000);
    data.push({
      time: h.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }),
      download: Math.round(Math.random() * 80 + 20),
      upload: Math.round(Math.random() * 30 + 5),
    });
  }
  return data;
}

function parseUptime(uptimeStr: string): string {
  // RouterOS uptime: "1w2d3h4m5s" → human readable
  const match = uptimeStr.match(/(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?/);
  if (!match) return uptimeStr;
  const [, w, d, h, m] = match;
  const parts = [];
  if (w) parts.push(`${w}s`);
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  if (m && parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ') || uptimeStr;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private routeros: RouterOSService,
    private clientsService: ClientsService,
    private plansService: PlansService,
    private database: DatabaseService,
  ) {}

  private formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  private parseDurationToMilliseconds(value: string) {
    const normalized = String(value || '').toLowerCase();
    const patterns: Array<[RegExp, number]> = [
      [/(\d+)\s*w/g, 7 * 24 * 60 * 60 * 1000],
      [/(\d+)\s*(jour|jours|day|days|d)/g, 24 * 60 * 60 * 1000],
      [/(\d+)\s*(heure|heures|hour|hours|h)/g, 60 * 60 * 1000],
      [/(\d+)\s*(minute|minutes|min|m)/g, 60 * 1000],
      [/(\d+)\s*(second|seconds|sec|s)/g, 1000],
    ];

    let total = 0;
    for (const [pattern, unit] of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(normalized)) !== null) {
        total += Number(match[1]) * unit;
      }
    }
    return total;
  }

  private buildAverageRate(bytes: number, uptime: string) {
    const durationMs = this.parseDurationToMilliseconds(uptime);
    if (!bytes || !durationMs) {
      return '0 kbps';
    }
    const kbps = (bytes * 8) / (durationMs / 1000) / 1000;
    return `${kbps.toFixed(kbps >= 10 ? 0 : 1)} kbps`;
  }

  private formatBitsPerSecond(bitsPerSecond: number) {
    if (!bitsPerSecond) {
      return '0 bps';
    }

    const units = ['bps', 'kbps', 'Mbps', 'Gbps'];
    let value = bitsPerSecond;
    let unitIndex = 0;

    while (value >= 1000 && unitIndex < units.length - 1) {
      value /= 1000;
      unitIndex += 1;
    }

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  async getInterfaceLiveStats(interfaceName = 'ether1') {
    try {
      const stats = await this.routeros.getInterfaceStats(interfaceName);
      const stat = stats[0] || {};
      const rxBitsPerSecond = parseInt(stat['rx-bits-per-second'] || stat['rx-bps'] || '0', 10) || 0;
      const txBitsPerSecond = parseInt(stat['tx-bits-per-second'] || stat['tx-bps'] || '0', 10) || 0;

      return {
        interface: interfaceName,
        rxBitsPerSecond,
        txBitsPerSecond,
        rxRate: this.formatBitsPerSecond(rxBitsPerSecond),
        txRate: this.formatBitsPerSecond(txBitsPerSecond),
      };
    } catch (err: any) {
      this.logger.warn(`Statistiques live interface non disponibles: ${err.message}`);
      return {
        interface: interfaceName,
        rxBitsPerSecond: 450200000,
        txBitsPerSecond: 120800000,
        rxRate: '450.2 Mbps',
        txRate: '120.8 Mbps',
      };
    }
  }

  async getCurrentUserInternetUsage() {
    const [hotspotSessions, pppoeSessions] = await Promise.all([
      this.routeros.getActiveHotspotSessions().catch(() => []),
      this.routeros.getActivePPPoESessions().catch(() => []),
    ]);

    const hotspotUsage = hotspotSessions.map((session, index) => {
      const bytesIn = parseInt(session['bytes-in'] || '0', 10) || 0;
      const bytesOut = parseInt(session['bytes-out'] || '0', 10) || 0;
      const username = session.user || session.name || `hotspot-${index + 1}`;
      return {
        id: session['.id'] || session.id || session['#'] || `hotspot-${index + 1}`,
        username,
        source: 'hotspot',
        address: session.address || '',
        uptime: session.uptime || '',
        downloadUsed: this.formatBytes(bytesIn),
        uploadUsed: this.formatBytes(bytesOut),
        downloadRate: this.buildAverageRate(bytesIn, session.uptime || ''),
        uploadRate: this.buildAverageRate(bytesOut, session.uptime || ''),
        totalBytes: bytesIn + bytesOut,
      };
    });

    const pppoeUsage = pppoeSessions.map((session, index) => {
      const bytesIn = parseInt(session['bytes-in'] || '0', 10) || 0;
      const bytesOut = parseInt(session['bytes-out'] || '0', 10) || 0;
      const username = session.name || session.user || `pppoe-${index + 1}`;
      return {
        id: session['.id'] || session.id || `pppoe-${index + 1}`,
        username,
        source: 'pppoe',
        address: session.address || '',
        uptime: session.uptime || '',
        downloadUsed: this.formatBytes(bytesIn),
        uploadUsed: this.formatBytes(bytesOut),
        downloadRate: this.buildAverageRate(bytesIn, session.uptime || ''),
        uploadRate: this.buildAverageRate(bytesOut, session.uptime || ''),
        totalBytes: bytesIn + bytesOut,
      };
    });

    return [...hotspotUsage, ...pppoeUsage]
      .sort((a, b) => b.totalBytes - a.totalBytes)
      .map(({ totalBytes, ...item }) => item);
  }

  async getDashboardSummary() {
    const [clientStats, hotspotClients, pppoeSessions, tickets, payments, clientHistories, userUsage, logs] = await Promise.all([
      this.clientsService.getStats(),
      this.getHotspotConnectedDevices(),
      this.getPPPoESessions(),
      this.database.getTickets(),
      this.database.getPayments(),
      this.database.getClientHistories(),
      this.getCurrentUserInternetUsage(),
      this.getLogs(),
    ]);

    const clientHistory = clientHistories
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const now = new Date();
    const monthlyRevenue = payments
      .filter((payment) => {
        const createdAt = new Date(payment.createdAt);
        return payment.state === 'Collected'
          && createdAt.getMonth() === now.getMonth()
          && createdAt.getFullYear() === now.getFullYear();
      })
      .reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0);

    const recentPayments = payments
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((payment) => ({
        id: payment.id,
        invoice: payment.invoice,
        client: payment.client,
        planName: payment.planName || '-',
        amount: `${parseFloat(payment.amount || '0').toLocaleString('fr')} Ar`,
        method: payment.method,
        createdAt: payment.createdAt,
        state: payment.state,
      }));

    const ticketActive = tickets.filter((ticket) => String(ticket.status).toLowerCase() === 'active').length;
    const ticketExpired = tickets.filter((ticket) => String(ticket.status).toLowerCase() === 'expired').length;

    return {
      metrics: {
        totalClients: clientStats.total,
        connectedClients: hotspotClients.length + pppoeSessions.length,
        ticketActive,
        ticketExpired,
        historyCount: clientHistories.length,
      },
      monthlyRevenue: `${monthlyRevenue.toLocaleString('fr')} Ar`,
      recentPayments,
      clientHistory,
      currentUsage: userUsage.slice(0, 6),
      alerts: logs.slice(0, 5),
    };
  }

  async getSystemHealth() {
    try {
      const res = await this.routeros.getSystemResources();
      const totalMem = parseInt(res['total-memory'] || '0');
      const freeMem = parseInt(res['free-memory'] || '0');
      const usedMem = totalMem - freeMem;
      const memPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;
      const totalHdd = parseInt(res['total-hdd-space'] || '0');
      const freeHdd = parseInt(res['free-hdd-space'] || '0');
      const hddPercent = totalHdd > 0 ? Math.round(((totalHdd - freeHdd) / totalHdd) * 100) : 0;

      return [
        {
          label: 'CPU',
          value: res['cpu-load'] || '0',
          unit: '%',
          icon: 'memory',
          trend: parseInt(res['cpu-load']) > 70 ? 'up' : 'stable',
          trendIcon: parseInt(res['cpu-load']) > 70 ? 'trending_up' : 'trending_flat',
          progress: parseInt(res['cpu-load']) || 0,
        },
        {
          label: 'RAM',
          value: Math.round(usedMem / (1024 * 1024)).toString(),
          unit: 'MB',
          icon: 'storage',
          trend: memPercent > 80 ? 'up' : 'stable',
          trendIcon: memPercent > 80 ? 'trending_up' : 'trending_flat',
          progress: memPercent,
        },
        {
          label: 'Uptime',
          value: parseUptime(res.uptime || ''),
          unit: '',
          icon: 'schedule',
          trend: 'stable',
          trendIcon: 'trending_flat',
          progress: 100,
        },
        {
          label: 'Stockage',
          value: Math.round((totalHdd - freeHdd) / (1024 * 1024)).toString(),
          unit: 'MB',
          icon: 'save',
          trend: hddPercent > 80 ? 'up' : 'stable',
          trendIcon: hddPercent > 80 ? 'trending_up' : 'trending_flat',
          progress: hddPercent,
        },
      ];
    } catch (err: any) {
      this.logger.warn(`RouterOS non disponible, utilisation des données seed: ${err.message}`);
      return SEED_MONITORING.systemHealth;
    }
  }

  async getPPPoESessions() {
    try {
      const sessions = await this.routeros.getActivePPPoESessions();
      return sessions.map((s) => ({
        id: s['.id'],
        user: s.name || s.user || '',
        profile: s['caller-id'] || '',
        ip: s.address || '',
        mac: s['caller-id'] || '',
        uptime: s.uptime || '',
        download: s['bytes-in'] ? `${Math.round(parseInt(s['bytes-in']) / 1024 / 1024)} MB` : '0',
        upload: s['bytes-out'] ? `${Math.round(parseInt(s['bytes-out']) / 1024 / 1024)} MB` : '0',
      }));
    } catch (err: any) {
      this.logger.warn(`Sessions PPPoE non disponibles: ${err.message}`);
      return [
        { id: 's1', user: 'jean.rakoto', profile: 'fiber-10mbps', ip: '10.0.1.2', mac: 'AA:BB:CC:11:22:33', uptime: '2h 15m', download: '1.2 GB', upload: '230 MB' },
        { id: 's2', user: 'marie.razafy', profile: 'fiber-20mbps', ip: '10.0.1.3', mac: 'AA:BB:CC:44:55:66', uptime: '5h 42m', download: '3.8 GB', upload: '890 MB' },
        { id: 's3', user: 'haja.rasolofo', profile: 'fiber-50mbps', ip: '10.0.1.4', mac: 'AA:BB:CC:77:88:99', uptime: '1d 2h', download: '12 GB', upload: '2.1 GB' },
      ];
    }
  }

  async getHotspotConnectedDevices() {
    try {
      const [sessions, hosts, leases] = await Promise.all([
        this.routeros.getActiveHotspotSessions(),
        this.routeros.getHotspotHosts(),
        this.routeros.getDHCPLeases(),
      ]);
      const clientPayload = await this.clientsService.findAll({});
      const clientsByLogin = new Map(clientPayload.data.map((client) => [client.pppoeLogin, client]));

      const hostsByMac = new Map(
        hosts
          .filter((host) => host['mac-address'])
          .map((host) => [host['mac-address'], host]),
      );
      const hostsByIp = new Map(
        hosts
          .filter((host) => host.address)
          .map((host) => [host.address, host]),
      );
      const leasesByMac = new Map(
        leases
          .filter((lease) => lease['mac-address'])
          .map((lease) => [lease['mac-address'], lease]),
      );
      const leasesByIp = new Map(
        leases
          .filter((lease) => lease.address)
          .map((lease) => [lease.address, lease]),
      );

      return Promise.all(sessions.map(async (session, index) => {
        const macAddress = session['mac-address'] || session['caller-id'] || '';
        const ipAddress = session.address || '';
        const host = hostsByMac.get(macAddress) || hostsByIp.get(ipAddress);
        const lease = leasesByMac.get(macAddress) || leasesByIp.get(ipAddress);
        const id = session['#']?.toString() || session['.id'] || session.id || index.toString();
        const username = session.user || session.name || '';
        const matchedClient = clientsByLogin.get(username);
        const matchedPlan = matchedClient?.planId
          ? await this.plansService.findById(matchedClient.planId)
          : null;

        return {
          id,
          username,
          server: session.server || '',
          ipAddress,
          'mac-address': macAddress,
          uptime: session.uptime || '',
          deviceName: host?.['host-name'] || lease?.['host-name'] || session.user || 'Unknown device',
          planId: matchedClient?.planId || '',
          planName: matchedPlan?.name || matchedClient?.planName || matchedClient?.plan || '',
        };
      }));
    } catch (err: any) {
      this.logger.warn(`Hotspot devices non disponibles: ${err.message}`);
      return [
        {
          id: '0',
          username: 'android-jrakoto',
          server: 'hotspot1',
          ipAddress: '192.168.88.101',
          'mac-address': '6C:2F:80:11:22:33',
          uptime: '1h12m',
          deviceName: 'Samsung Galaxy A15',
        },
        {
          id: '1',
          username: 'iphone-mrasoa',
          server: 'hotspot1',
          ipAddress: '192.168.88.102',
          'mac-address': '2A:7B:91:44:55:66',
          uptime: '24m',
          deviceName: 'iPhone 13',
        },
      ];
    }
  }

  async getInterfaces() {
    try {
      const ifaces = await this.routeros.getInterfaceTraffic();
      return ifaces.map((i) => ({
        name: i.name,
        type: i.type,
        running: i.running === 'true',
        disabled: i.disabled === 'true',
        rxBytes: i['rx-byte'] || '0',
        txBytes: i['tx-byte'] || '0',
        comment: i.comment || '',
      }));
    } catch (err: any) {
      this.logger.warn(`Interfaces non disponibles: ${err.message}`);
      return [
        { name: 'ether1', type: 'ether', running: true, disabled: false, rxBytes: '15GB', txBytes: '8GB', comment: 'WAN' },
        { name: 'ether2', type: 'ether', running: true, disabled: false, rxBytes: '12GB', txBytes: '6GB', comment: 'LAN' },
        { name: 'pppoe-out1', type: 'pppoe-out', running: true, disabled: false, rxBytes: '10GB', txBytes: '5GB', comment: 'Uplink' },
      ];
    }
  }

  async getLogs() {
    try {
      const logs = await this.routeros.getLogs(30);
      return logs.map((l) => ({
        id: l['.id'],
        time: l.time || '',
        topics: l.topics || '',
        message: l.message || '',
        severity: l.topics?.includes('error') ? 'error' : l.topics?.includes('warning') ? 'warning' : 'info',
      }));
    } catch (err: any) {
      this.logger.warn(`Logs non disponibles: ${err.message}`);
      return SEED_MONITORING.alerts.map((a, i) => ({
        id: `log${i}`,
        time: a.time,
        topics: a.severity,
        message: a.description,
        severity: a.severity,
      }));
    }
  }

  async pingDevice(address: string) {
    try {
      const result = await this.routeros.ping(address, 4);
      const successful = result.filter((r) => r.status !== 'timeout');
      const avgRtt = successful.length > 0
        ? Math.round(successful.reduce((s, r) => s + parseFloat(r['avg-rtt'] || '0'), 0) / successful.length)
        : null;

      return {
        address,
        sent: result.length,
        received: successful.length,
        packetLoss: `${Math.round(((result.length - successful.length) / result.length) * 100)}%`,
        avgRtt: avgRtt ? `${avgRtt}ms` : 'N/A',
        online: successful.length > 0,
      };
    } catch (err: any) {
      return { address, error: err.message, online: false };
    }
  }

  async disconnectSession(sessionId: string) {
    try {
      await this.routeros.disconnectPPPoESession(sessionId);
      return { message: `Session ${sessionId} déconnectée`, success: true };
    } catch (err: any) {
      return { message: err.message, success: false };
    }
  }

  async disconnectHotspotSession(id: string) {
    try {
      const session = await this.routeros.getActiveHotspotSessionById(id);
      const username = session?.user || session?.name || '';

      await this.routeros.disconnectHotspotSession(id);

      if (username) {
        const hotspotUser = await this.routeros.getHotspotUserByName(username);
        const hotspotUserId = hotspotUser?.['.id'] || hotspotUser?.id || hotspotUser?.['#'];

        if (hotspotUserId) {
          await this.routeros.deleteHotspotUser(hotspotUserId);
        }
      }

      return {
        message: `Hotspot session ${id} déconnectée et utilisateur supprimé`,
        success: true,
      };
    } catch (err: any) {
      return { message: err.message, success: false };
    }
  }

  async getFullDashboard() {
    const [systemHealth, sessions, hotspotClients, interfaces, interfaceLiveStats, logs, currentUsage] = await Promise.all([
      this.getSystemHealth(),
      this.getPPPoESessions(),
      this.getHotspotConnectedDevices(),
      this.getInterfaces(),
      this.getInterfaceLiveStats(),
      this.getLogs(),
      this.getCurrentUserInternetUsage(),
    ]);

    return {
      systemHealth,
      pppoeSessionCount: sessions.length,
      pppoeActiveSessions: sessions,
      hotspotSessionCount: hotspotClients.length,
      hotspotClients,
      interfaces,
      interfaceLiveStats,
      currentUsage,
      recentLogs: logs,
      trafficChart: SEED_MONITORING.trafficChart,
      alerts: SEED_MONITORING.alerts,
      equipmentStatus: SEED_MONITORING.equipments,
    };
  }
}
