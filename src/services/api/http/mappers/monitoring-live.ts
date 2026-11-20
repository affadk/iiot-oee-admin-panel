/**
 * Mapper backend→lokal — live state (snapshot perangkat).
 *
 * Dipisah dari mappers/monitoring.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file mapper = satu domain). Barrel penggabung: mappers/monitoring.ts.
 */
import { LiveStateRecord, MachineFsmState } from '../../../../types/monitoring';
import { normalizeFsmState } from '../../../../utils/oeeCalculations';
import { num, str, iso, pick } from '../primitives';

/**
 * E20 P20.5 (FAT-157): `device_online` BUKAN hardcode `true` — dibaca bila
 * server mengirim `isOnline`/`device_online`, bila tidak diturunkan dari
 * proyeksi TTL atas `lastTelemetryAt`/`updatedAt` (§7E,
 * `DEVICE_PRESENCE_TTL_SEC=300`); live-state sendiri tidak membawa
 * `isOnline`. Tanpa timestamp yang bisa diproyeksikan → offline (false).
 * Field `spindleRpm`/`machineTempC`/`plcAlarmCode` DIHAPUS — tidak ada di
 * respons §B; nilai PLC itu datang lewat WS `plc_modbus` (§7A), bukan
 * dari snapshot live-state HTTP.
 */
export function mapLiveState(raw: unknown): LiveStateRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  const lastTelemetryAt = iso(pick(r.lastTelemetryAt, r.last_telemetry_at, r.updatedAt, r.updated_at));
  const updatedAt = iso(pick(r.updatedAt, r.updated_at));
  const onlineFlag = pick(r.isOnline, r.device_online);
  const deviceOnline =
    typeof onlineFlag === 'boolean'
      ? onlineFlag
      : (() => {
          const tsMs = Date.parse(lastTelemetryAt) || Date.parse(updatedAt);
          if (!Number.isFinite(tsMs) || tsMs <= 0) return false;
          return Date.now() - tsMs <= 300_000;
        })();
  return {
    device_id: str(pick(r.deviceId, r.device_id)),
    machine_id: (pick(r.machineId, r.machine_id) as string | null) ?? null,
    machine_name: str(pick(r.machineName, r.machine_name), ''),
    wo_id: (pick(r.woId, r.wo_id) as string | null) ?? null,
    fsm_state: normalizeFsmState(str(pick(r.currentState, r.fsm_state, r.state), 'UNCONFIGURED')) as MachineFsmState,
    oee: num(pick(r.oee), 0),
    availability: num(pick(r.availability), 0),
    performance: num(pick(r.performance), 0),
    quality: num(pick(r.quality), 0),
    total_count: num(pick(r.totalCount, r.total_count), 0),
    good_count: num(pick(r.goodCount, r.good_count), 0),
    reject_count: num(pick(r.rejectCount, r.reject_count), 0),
    last_cycle_time_sec: num(pick(r.lastCycleTimeSec, r.last_cycle_time_sec), 0) || undefined,
    operating_time_seconds: num(pick(r.operatingTimeSec, r.operating_time_sec, r.operatingTimeSeconds), 0),
    run_time_seconds: num(pick(r.runTimeSec, r.run_time_sec, r.runTimeSeconds), 0),
    downtime_seconds: num(pick(r.downtimeSec, r.downtime_sec, r.downtimeSeconds), 0),
    uptime_seconds: num(pick(r.uptimeSeconds, r.uptime_seconds), 0) || undefined,
    free_heap_bytes: num(pick(r.freeHeapBytes, r.free_heap_bytes), 0) || undefined,
    active_work_order: (pick(r.woId, r.wo_id) as string | null) ?? null,
    active_product: null,
    last_telemetry_at: lastTelemetryAt,
    updated_at: updatedAt,
    device_online: deviceOnline,
  };
}
