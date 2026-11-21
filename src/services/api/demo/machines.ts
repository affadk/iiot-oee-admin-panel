/**
 * BARREL — komposisi demoMachines per sub-domain (tanpa logika bisnis).
 *
 * Dipisah dari file 519 baris pada E32.5 (FAT-286), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Urutan method sama seperti
 * sebelumnya: reads → mutations → binding.
 */
import { demoMachinesReads } from './machines/reads';
import { demoMachinesMutations } from './machines/mutations';
import { demoMachinesBinding } from './machines/binding';

export const demoMachines = {
  ...demoMachinesReads,
  ...demoMachinesMutations,
  ...demoMachinesBinding,
};
