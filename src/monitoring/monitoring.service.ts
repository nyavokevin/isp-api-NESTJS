import { Injectable, Logger } from '@nestjs/common';
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

  constructor(private routeros: RouterOSService) {}

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

  async getFullDashboard() {
    const [systemHealth, sessions, interfaces, logs] = await Promise.all([
      this.getSystemHealth(),
      this.getPPPoESessions(),
      this.getInterfaces(),
      this.getLogs(),
    ]);

    return {
      systemHealth,
      pppoeSessionCount: sessions.length,
      pppoeActiveSessions: sessions,
      interfaces,
      recentLogs: logs,
      trafficChart: SEED_MONITORING.trafficChart,
      alerts: SEED_MONITORING.alerts,
      equipmentStatus: SEED_MONITORING.equipments,
    };
  }
}
