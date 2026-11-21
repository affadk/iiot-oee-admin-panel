/**
 * BARREL — komposisi demoDevices per sub-domain (tanpa logika bisnis).
 *
 * Dipisah dari file 485 baris pada E32.5 (FAT-286), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Urutan method sama seperti
 * sebelumnya: reads → registration → lifecycle.
 */
import { demoDevicesReads } from './devices/reads';
import { demoDevicesRegistration } from './devices/registration';
import { demoDevicesLifecycle } from './devices/lifecycle';

export const demoDevices = {
  ...demoDevicesReads,
  ...demoDevicesRegistration,
  ...demoDevicesLifecycle,
};
