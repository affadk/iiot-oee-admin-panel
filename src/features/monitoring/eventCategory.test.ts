/**
 * FAT-304 (P33.8): tes pemetaan keluarga event Opsi 3.
 * Menjamin 32 nilai eksplisit terpetakan tepat satu kategori, tanpa
 * tumpang tindih, tanpa ada yang hilang; pola terpetakan benar.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OPERATIONAL_EVENT_TYPES } from '../../types/monitoring';
import { eventTypeCategory, eventTypeOptionsForCategory } from './eventCategory';

describe('eventTypeCategory (FAT-304)', () => {
  it('32 nilai eksplisit terpetakan: 14 operasional + 18 sistem, tanpa tumpang tindih', () => {
    const operational = eventTypeOptionsForCategory('operational');
    const system = eventTypeOptionsForCategory('system');
    assert.equal(operational.length, 14);
    assert.equal(system.length, 18);
    assert.equal(new Set([...operational, ...system]).size, 32);
    assert.deepEqual(
      [...operational, ...system].sort(),
      [...OPERATIONAL_EVENT_TYPES].sort(),
    );
  });

  it('keluarga operasional berisi tipe perangkat/proses', () => {
    for (const t of [
      'DEVICE_OFFLINE',
      'DEVICE_ONLINE',
      'DEVICE_PROVISIONED',
      'MACHINE_BOUND',
      'WO_DISPATCH_INITIATED',
      'WORK_ORDER_COMPLETED',
    ]) {
      assert.equal(eventTypeCategory(t), 'operational');
    }
  });

  it('keluarga sistem berisi tipe admin/sistem + ack + security', () => {
    for (const t of [
      'OPERATOR_PROVISIONED',
      'OPERATOR_UPDATED',
      'MOSQUITTO_CONFIG_STAGED',
      'MASTER_DATA_MUTATION',
      'PRODUCT_DELETED',
      'AUTH_TOKEN_REFRESHED',
      'OPERATIONAL_EVENT_ACKNOWLEDGED',
      'SECURITY_REJECTION',
    ]) {
      assert.equal(eventTypeCategory(t), 'system');
    }
  });

  it('pola terpetakan benar', () => {
    assert.equal(eventTypeCategory('DEVICE_EVENT_12'), 'operational');
    assert.equal(eventTypeCategory('MQTT_ADMIN_RESTART'), 'system');
    assert.equal(eventTypeCategory('COMMAND_PAUSE_DISPATCHED'), 'system');
    assert.equal(eventTypeCategory('COMMAND_COUNT_ADJUST_DISPATCHED'), 'system');
  });

  it('urutan opsi mengikuti OPERATIONAL_EVENT_TYPES (stabil)', () => {
    const operational = eventTypeOptionsForCategory('operational');
    const order = OPERATIONAL_EVENT_TYPES.filter((t) => operational.includes(t));
    assert.deepEqual(operational, order);
  });
});
