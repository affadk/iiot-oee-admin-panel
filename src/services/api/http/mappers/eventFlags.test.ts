import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_FLAG_BITS, decodeEventFlags } from './assets';

// FAT-202 (N-32): tabel bit harus cocok firmware `App/Inc/tasks_config.h`
// (12 bit, 1..2048). Tabel lama (NTP_SYNCED/MQTT_TLS_ACTIVE/MODBUS_*)
// karangan — tes ini mengunci tabel otoritatif.

test('N-32: EVENT_FLAG_BITS = 12 bit firmware (1..2048), tanpa bit karangan', () => {
  assert.deepEqual(EVENT_FLAG_BITS, [
    [1, 'ETHERNET_UP'],
    [2, 'MQTT_CONNECTED'],
    [4, 'JOB_CONFIGURED'],
    [8, 'EMERGENCY_STOP'],
    [16, 'SD_CARD_PRESENT'],
    [32, 'FLASH_WARNING'],
    [64, 'WEB_GUI_ACTIVE'],
    [128, 'WEB_GUI_TIMEOUT'],
    [256, 'PVD_EMERGENCY'],
    [512, 'HEAP_LOW'],
    [1024, 'STACK_OVERFLOW'],
    [2048, 'START_REJECTED'],
  ]);
});

test('N-32: decodeEventFlags bitmask → nama bit firmware', () => {
  assert.deepEqual(decodeEventFlags(0), []);
  assert.deepEqual(decodeEventFlags(1), ['ETHERNET_UP']);
  assert.deepEqual(decodeEventFlags(2048), ['START_REJECTED']);
  // EMERGENCY_STOP | HEAP_LOW | START_REJECTED
  assert.deepEqual(decodeEventFlags(8 | 512 | 2048), ['EMERGENCY_STOP', 'HEAP_LOW', 'START_REJECTED']);
  // bit tak dikenal (mis. 4096) diabaikan, bukan dipetakan salah
  assert.deepEqual(decodeEventFlags(4096 | 2), ['MQTT_CONNECTED']);
});

test('N-32: decodeEventFlags array string diteruskan, selain itu []', () => {
  assert.deepEqual(decodeEventFlags(['ETHERNET_UP']), ['ETHERNET_UP']);
  assert.deepEqual(decodeEventFlags('1'), []);
  assert.deepEqual(decodeEventFlags(null), []);
  assert.deepEqual(decodeEventFlags(undefined), []);
});
