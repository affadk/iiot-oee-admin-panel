// E32.3 (FAT-284): dipecah dari deviceMachineBinding.test.ts — binding device-machine 1:1 (BIND, UNBIND, audit, operational event & WS).
// Kode sumber tidak diubah, hanya pemecahan file tes per domain.
// snapshotStore/restoreStore diduplikasi di tiap file (pola yang sama
// dengan helper stub di e23-batch*): tiap file tes mandiri.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, store } from '../../services/api/client';
import { telemetrySocket, TelemetryWsEvent } from '../../services/ws/telemetrySocket';

function snapshotStore() {
  return {
    machines: store.machines.map((m) => ({ ...m })),
    devices: store.devices.map((d) => ({ ...d })),
    liveStates: store.liveStates.map((l) => ({ ...l })),
    workOrders: store.workOrders.map((w) => ({ ...w })),
    downtimes: store.downtimes.map((dt) => ({ ...dt })),
    operationalEvents: store.operationalEvents.map((ev) => ({ ...ev })),
    auditLogs: store.auditLogs.map((al) => ({ ...al })),
    iamAuditDecisions: store.iamAuditDecisions.map((d) => ({ ...d })),
    role: apiClient.getUserRole(),
    network: apiClient.getNetworkMode(),
    isAuthenticated: store.isAuthenticated,
    authToken: store.authToken,
    tokenAuthzVersion: store.tokenAuthzVersion,
    iamMode: store.iamInfo.mode,
    hooks: { ...store.hooks },
  };
}

function restoreStore(snap: ReturnType<typeof snapshotStore>) {
  store.machines = snap.machines;
  store.devices = snap.devices;
  store.liveStates = snap.liveStates;
  store.workOrders = snap.workOrders;
  store.downtimes = snap.downtimes;
  store.operationalEvents = snap.operationalEvents;
  store.auditLogs = snap.auditLogs;
  store.iamAuditDecisions = snap.iamAuditDecisions;
  apiClient.setNetworkMode(snap.network);
  apiClient.setIamMode(snap.iamMode);
  apiClient.setUserRole(snap.role);
  store.isAuthenticated = snap.isAuthenticated;
  store.authToken = snap.authToken;
  store.tokenAuthzVersion = snap.tokenAuthzVersion;
  apiClient.setAuthHooks(snap.hooks);
}

test('Test C — Device-Machine Binding (1:1 Invariant, BIND, UNBIND, Audit, OperationalEvent & WS)', async () => {
  const snap = snapshotStore();
  try {
    apiClient.setNetworkMode('LAN');
    apiClient.setUserRole('ADMIN');
    apiClient.setSessionActive(true);

    const wsEvents: TelemetryWsEvent[] = [];
    const unsub = telemetrySocket.subscribe((ev) => wsEvents.push(ev));
    try {
      const prevAuditCount = store.auditLogs.length;
      const prevOpEventCount = store.operationalEvents.length;

      // C1: Bind unbound STM32-OEE-05 -> unbound CNC-GRIND-05
      const boundMachine = await apiClient.bindDevice('CNC-GRIND-05', { device_id: 'STM32-OEE-05' });
      assert.equal(boundMachine.bound_device_id, 'STM32-OEE-05');
      assert.equal(boundMachine.boundDevice?.device_id, 'STM32-OEE-05');

      const dev05 = await apiClient.getDeviceById('STM32-OEE-05');
      assert.equal(dev05.bound_machine_id, 'CNC-GRIND-05');
      assert.equal(dev05.boundMachine?.machine_id, 'CNC-GRIND-05');

      // Audit Log + Operational Event + WS emitted
      assert.equal(store.auditLogs.length, prevAuditCount + 1);
      assert.equal(store.auditLogs[0].event_type, 'MACHINE_BOUND');
      assert.equal(store.operationalEvents.length, prevOpEventCount + 1);
      assert.equal(store.operationalEvents[0].event_type, 'MACHINE_BOUND');
      assert.ok(wsEvents.some((e) => e.type === 'MACHINE_BOUND' && (e as any).payload.device_id === 'STM32-OEE-05'));

      // C2: Bind another device to already bound CNC-GRIND-05 -> 409 MACHINE_ALREADY_BOUND
      const extraDev = await apiClient.registerDevice({
        device_id: 'STM32-EXTRA-99',
        mac_address: 'AA:BB:CC:DD:EE:99',
      });
      await assert.rejects(
        () => apiClient.bindDevice('CNC-GRIND-05', { device_id: extraDev.device_id }),
        (err: any) => err.httpStatus === 409 && err.code === 'MACHINE_ALREADY_BOUND'
      );

      // C3: Bind already bound STM32-OEE-05 to new unbound machine -> 409 DEVICE_ALREADY_BOUND
      const unboundM = await apiClient.createMachine({
        machine_id: 'CNC-UNBOUND-99',
        name: 'Unbound Target 99',
        modbus_slave_id: 99,
      });
      await assert.rejects(
        () => apiClient.bindDevice(unboundM.machine_id, { device_id: 'STM32-OEE-05' }),
        (err: any) => err.httpStatus === 409 && err.code === 'DEVICE_ALREADY_BOUND'
      );

      // C4: Unbind CNC-GRIND-05 -> succeeds, emits Audit + OperationalEvent + WS MACHINE_UNBOUND
      const unboundResult = await apiClient.unbindDevice('CNC-GRIND-05');
      assert.equal(unboundResult.bound_device_id, null);
      assert.equal(unboundResult.boundDevice, null);
      const dev05Freed = await apiClient.getDeviceById('STM32-OEE-05');
      assert.equal(dev05Freed.bound_machine_id, null);
      assert.equal(store.auditLogs[0].event_type, 'MACHINE_UNBOUND');
      assert.equal(store.operationalEvents[0].event_type, 'MACHINE_UNBOUND');
      assert.ok(wsEvents.some((e) => e.type === 'MACHINE_UNBOUND' && (e as any).payload.machine_id === 'CNC-GRIND-05'));

      // C5: Unbind already unbound machine -> 400 MACHINE_NOT_BOUND
      await assert.rejects(
        () => apiClient.unbindDevice('CNC-GRIND-05'),
        (err: any) => err.httpStatus === 400 && err.code === 'MACHINE_NOT_BOUND'
      );

      // C6: Unbind machine with ACTIVE/PENDING WO -> 409 MACHINE_HAS_ACTIVE_WO
      await assert.rejects(
        () => apiClient.unbindDevice('CNC-MILLING-01'),
        (err: any) => err.httpStatus === 409 && err.code === 'MACHINE_HAS_ACTIVE_WO'
      );

      // C7: Re-bind freed device to CNC-UNBOUND-99 -> succeeds
      const rebound = await apiClient.bindDevice('CNC-UNBOUND-99', { device_id: 'STM32-OEE-05' });
      assert.equal(rebound.bound_device_id, 'STM32-OEE-05');
    } finally {
      unsub();
    }
  } finally {
    restoreStore(snap);
  }
});
