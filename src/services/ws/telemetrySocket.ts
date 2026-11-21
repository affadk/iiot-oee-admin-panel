import { DemoTelemetrySimulator } from './telemetrySim';
import {
  parseWsIncomingFrame,
  KNOWN_WS_TYPES,
  type TelemetryWsEvent,
  type TelemetryWsLifecycleEvent,
} from './telemetryFrame';
import {
  resolveApiMode,
  resolveWsUrl,
  resolveWsHeartbeatMs,
  resolveWsReconnectMaxMs,
} from '../api/mode';

// Re-export API frame (parser + tipe event) agar impor lama
// (`./telemetrySocket`) tetap jalan setelah pemecahan E31.16.
export {
  parseWsIncomingFrame,
  normalizeWsTimestamp,
  KNOWN_WS_TYPES,
} from './telemetryFrame';
export type {
  TelemetryWsTelemetryEvent,
  TelemetryWsHealthData,
  TelemetryWsHealthEvent,
  TelemetryWsLifecycleEvent,
  TelemetryWsEvent,
} from './telemetryFrame';

/**
 * Build Guide §10 & API Doc §4/§7.A — Singleton Real-Time WebSocket Client (/ws/telemetry)
 * - Single shared connection per browser session (no Bearer header — origin + perimeter guarded)
 * - Application-level heartbeat: sends text "ping", handles text "pong"
 * - Ignores unknown event types safely without dropping connection
 * - Ignores `is_buffered: true` payloads for live telemetry state
 * - Exponential backoff 1s -> 30s; closes 4403 (forbidden origin) / 4429 (rate limit) handled gracefully
 * - Triggers snapshot live-state refetch callback upon reconnect
 */

export type WsConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RATE_LIMITED' | 'FORBIDDEN_ORIGIN';

class TelemetrySocketSingleton {
  private ws: WebSocket | null = null;
  private status: WsConnectionStatus = 'DISCONNECTED';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private demoSim = new DemoTelemetrySimulator((event) => this.eventListeners.forEach((cb) => cb(event)));
  private eventListeners = new Set<(event: TelemetryWsEvent) => void>();
  private statusListeners = new Set<(status: WsConnectionStatus) => void>();
  private reconnectHandlers = new Set<() => void>();

  getStatus(): WsConnectionStatus {
    return this.status;
  }

  connect(onReconnectRefetch?: () => void): void {
    if (onReconnectRefetch) {
      this.reconnectHandlers.add(onReconnectRefetch);
    }
    // Mode Demo: tidak ada backend/WS sungguhan — simulasikan TELEMETRY_UPDATE
    // lokal (interval dari VITE_DEMO_SIM_INTERVAL_MS) agar Live State tetap
    // bergerak tanpa reconnect-loop ke origin yang tidak punya server WS.
    if (resolveApiMode() === 'demo') {
      this.startDemoSimulation();
      return;
    }
    if (typeof WebSocket === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('CONNECTING');
    try {
      const url = resolveWsUrl();
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        const wasReconnect = this.reconnectAttempt > 0;
        this.reconnectAttempt = 0;
        this.setStatus('CONNECTED');
        this.startHeartbeat();
        if (wasReconnect) {
          this.reconnectHandlers.forEach((cb) => cb());
        }
      };

      socket.onmessage = (evt) => {
        if (typeof evt.data !== 'string') return;
        const frame = parseWsIncomingFrame(evt.data);
        if (!frame || frame === 'pong') return;
        this.eventListeners.forEach((cb) => cb(frame));
      };

      socket.onclose = (evt) => {
        this.stopHeartbeat();
        this.ws = null;
        if (evt.code === 4403) {
          this.setStatus('FORBIDDEN_ORIGIN');
          return;
        }
        if (evt.code === 4429) {
          this.setStatus('RATE_LIMITED');
          this.scheduleReconnect(resolveWsReconnectMaxMs());
          return;
        }
        this.setStatus('DISCONNECTED');
        this.scheduleReconnect();
      };

      socket.onerror = () => {
        // Handled via onclose backoff
      };
    } catch {
      this.setStatus('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopDemoSimulation();
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('DISCONNECTED');
  }

  subscribe(listener: (event: TelemetryWsEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  emitLifecycleEvent(
    type: TelemetryWsLifecycleEvent['type'],
    payload: Record<string, unknown>,
    timestampIso: string = new Date().toISOString()
  ): void {
    if (!KNOWN_WS_TYPES.has(type)) return;
    const event: TelemetryWsLifecycleEvent = {
      type,
      payload: { type, timestamp: timestampIso, ...payload },
      timestampIso,
    };
    this.eventListeners.forEach((cb) => cb(event));
  }

  subscribeStatus(listener: (status: WsConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(next: WsConnectionStatus): void {
    this.status = next;
    this.statusListeners.forEach((cb) => cb(next));
  }

  /** Simulasi WS mode Demo: TELEMETRY_UPDATE lokal (interval env). */
  private startDemoSimulation(): void {
    if (this.demoSim.isRunning()) return;
    this.setStatus('CONNECTING');
    this.demoSim.start();
    this.setStatus('CONNECTED');
  }

  private stopDemoSimulation(): void {
    this.demoSim.stop();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, resolveWsHeartbeatMs());
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(explicitDelayMs?: number): void {
    if (this.reconnectTimer || this.eventListeners.size === 0) return;
    const delayMs =
      explicitDelayMs ?? Math.min(resolveWsReconnectMaxMs(), 1000 * Math.pow(2, this.reconnectAttempt));
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.eventListeners.size > 0) {
        this.connect();
      }
    }, delayMs);
  }
}

export const telemetrySocket = new TelemetrySocketSingleton();
