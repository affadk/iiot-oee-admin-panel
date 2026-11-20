/**
 * BARREL — tipe MQTT per domain (E31.15, FAT-278, R10).
 *
 * Dipisah dari satu file yang mencampur Dynamic Security + konfigurasi
 * broker pada refactoring E31.15 (2026-11-20). Impor lama (`./mqtt`,
 * `../types/mqtt`) tetap jalan lewat re-export ini.
 */
export * from './mqtt-dynsec';
export * from './mqtt-config';
