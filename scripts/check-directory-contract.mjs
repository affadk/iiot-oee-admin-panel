#!/usr/bin/env node
/**
 * check-directory-contract.mjs — Penegak kontrak `docs/DIRECTORY_STRUCTURE.md`.
 *
 * Menghitung baris tiap file TypeScript di src dan membandingkannya dengan
 * anggaran per folder (lunak = warning, keras = FAIL, exit 1).
 * Semua baris dihitung (import + komentar), seperti Biome noExcessiveLinesPerFile.
 *
 * Pengecualian (file lama yang masih di atas batas keras) HARUS tercatat di
 * EXCEPTIONS dengan nomor issue Linear — dan issue-nya harus Todo.
 *
 * Pemakaian: `node scripts/check-directory-contract.mjs` atau `npm run check:structure`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', 'src');

// { file relatif terhadap src, alasan, issue Linear }
const EXCEPTIONS = new Map([
  ['features/system/AccessControlPage.tsx', 'R9.5'],
  ['features/production/OperatorsPage.tsx', 'R9.5'],
  ['features/assets/MachinesPage.tsx', 'R9.5'],
  ['features/analytics/TelemetryHistoryPage.tsx', 'R9.5'],
  ['features/production/WorkOrdersPage.tsx', 'R9.5'],
  ['features/mqtt/DynamicSecurityPage.tsx', 'R9.5'],
  ['features/assets/DevicesPage.tsx', 'R9.5'],
  ['features/mqtt/BrokerConfigManagerPage.tsx', 'R9.5'],
  ['utils/historicalExport.ts', 'R9.5'],
  ['features/monitoring/OperationalEventsPage.tsx', 'R9.5'],
  ['features/analytics/OeeAnalyticsPage.tsx', 'R9.5'],
]);

// Anggaran: [lunak, keras]. Urutan penting — pola pertama yang cocok menang.
const BUDGETS = [
  // File test: panjang karena data kasus uji; tetap satu file per modul yang diuji
  [/\.test\.tsx?$/, [500, 800]],
  // Data/registry tabular (kohesif, tetap per domain)
  [/^services\/api\/(seeds|endpoints)\//, [500, 900]],
  // Modul domain API
  [/^services\/api\/(demo|http|schemas)\//, [400, 600]],
  // Barrel/konfigurasi API
  [/^services\/api\/mode\.ts$/, [300, 500]],
  [/^services\/api\/[^/]+\.ts$/, [150, 300]],
  // Fitur: page / komponen / hook
  [/^features\/[^/]+\/components\//, [200, 300]],
  [/^features\/[^/]+\/hooks\//, [150, 250]],
  [/^features\/[^/]+\/[^/]+\.tsx$/, [400, 600]],
  [/^features\/shared\//, [300, 500]],
  // Utilitas & kapabilitas
  [/^utils\//, [300, 500]],
  [/^services\/ws\//, [300, 500]],
  [/^types\//, [300, 500]],
  [/^context\//, [200, 300]],
  [/^components\//, [250, 350]],
  [/^layouts\//, [250, 400]],
  [/^app\//, [150, 250]],
  [/^[^/]+\.tsx?$/, [150, 250]],
];

function budgetFor(rel) {
  const p = rel.split(sep).join('/');
  for (const [re, budget] of BUDGETS) {
    if (re.test(p)) return budget;
  }
  return [300, 500];
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(ROOT);
let fail = 0;
let warn = 0;
let excepted = 0;
const rows = [];

for (const full of files) {
  const rel = relative(ROOT, full).split(sep).join('/');
  const lines = readFileSync(full, 'utf8').split('\n').length;
  const [soft, hard] = budgetFor(rel);
  const exception = EXCEPTIONS.get(rel);
  let status = 'OK';
  if (lines > hard) {
    if (exception) {
      status = `EXCEPTION (${exception})`;
      excepted++;
    } else {
      status = 'FAIL';
      fail++;
    }
  } else if (lines > soft) {
    status = 'WARN';
    warn++;
  }
  rows.push({ rel, lines, soft, hard, status });
}

rows.sort((a, b) => b.lines - a.lines);
const pad = (s, n) => String(s).padEnd(n);
console.log('Directory contract — IIoT OEE Admin Panel (docs/DIRECTORY_STRUCTURE.md)');
console.log(`${pad('file', 62)} ${pad('baris', 6)} ${pad('lunak', 6)} ${pad('keras', 6)} status`);
for (const r of rows) {
  if (r.status === 'OK') continue;
  console.log(`${pad(r.rel, 62)} ${pad(r.lines, 6)} ${pad(r.soft, 6)} ${pad(r.hard, 6)} ${r.status}`);
}
console.log(
  `\n${files.length} file diperiksa — ${fail} FAIL, ${warn} WARN (di atas lunak), ${excepted} pengecualian tercatat.`,
);
if (fail > 0) {
  console.log(
    'Pelanggaran batas keras: pecah file di atas per domain (lihat docs/DIRECTORY_STRUCTURE.md §2–§4), atau catat pengecualian + issue Linear.',
  );
  process.exit(1);
}
