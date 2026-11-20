/**
 * Simulasi WebSocket mode Demo — TELEMETRY_UPDATE lokal (interval env).
 *
 * Dipisah dari services/ws/telemetrySocket.ts pada refactoring E31.16
 * (FAT-279, audit P3-2): client socket tidak lagi menampung logika
 * simulasi demo. Dipakai TelemetrySocketSingleton saat mode Demo.
 */
import { TelemetryWsTelemetryEvent } from './telemetryFrame';
import { resolveDemoSimIntervalMs } from '../api/mode';

/** Perangkat seed demo untuk simulasi WS lokal (id sama dengan mockData). */
const DEMO_SIM_DEVICES: Array<{ device_id: string; machine_id: string }> = [
  { device_id: 'STM32-OEE-01', machine_id: 'CNC-MILLING-01' },
  { device_id: 'STM32-OEE-02', machine_id: 'CNC-LATHE-02' },
  { device_id: 'STM32-OEE-03', machine_id: 'CNC-PRESS-03' },
  { device_id: 'STM32-OEE-04', machine_id: 'CNC-WELD-04' },
];

/**
 * Simulator demo: memancarkan TELEMETRY_UPDATE lokal per perangkat seed
 * pada interval env, tanpa koneksi WS sungguhan.
 */
export class DemoTelemetrySimulator {
  private simTimer: ReturnType<typeof setInterval> | null = null;
  private simCounters = new Map<string, { total: number; good: number; reject: number }>();

  constructor(private emit: (event: TelemetryWsTelemetryEvent) => void) {}

  isRunning(): boolean {
    return this.simTimer !== null;
  }

  start(): void {
    if (this.simTimer) return;
    this.emitOnce();
    this.simTimer = setInterval(() => this.emitOnce(), resolveDemoSimIntervalMs());
  }

  stop(): void {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
  }

  private emitOnce(): void {
    for (const dev of DEMO_SIM_DEVICES) {
      const prev = this.simCounters.get(dev.device_id) ?? {
        total: 1200 + Math.floor(Math.random() * 800),
        good: 0,
        reject: 0,
      };
      const produced = 1 + Math.floor(Math.random() * 3);
      const rejects = Math.random() < 0.08 ? 1 : 0;
      const next = {
        total: prev.total + produced,
        good: (prev.good || prev.total) + produced - rejects,
        reject: prev.reject + rejects,
      };
      this.simCounters.set(dev.device_id, next);
      const jitter = (base: number, span: number) => Math.round((base + Math.random() * span) * 10) / 10;
      const event: TelemetryWsTelemetryEvent = {
        type: 'TELEMETRY_UPDATE',
        device_id: dev.device_id,
        machine_id: dev.machine_id,
        fsm_state: 'RUNNING',
        is_buffered: false,
        timestampIso: new Date().toISOString(),
        counters: { total: next.total, good: next.good, reject: next.reject, last_cycle_sec: jitter(28, 6) },
        oee: {
          availability: jitter(88, 8),
          performance: jitter(90, 6),
          quality: jitter(97, 2.5),
          total_oee: jitter(80, 9),
        },
        plc_modbus: {
          spindle_rpm: Math.round(2400 + Math.random() * 400),
          temp_c: jitter(42, 6),
          alarm_code: 0,
        },
      };
      this.emit(event);
    }
  }
}
