import test from 'node:test';
import assert from 'node:assert/strict';
import { combineIsRefreshing, combineQueryStatus, toWidgetState } from './oeeWidgetState';

// ---------------------------------------------------------------------------
// E12 T12.5 (U-2 / FAT-52): helper status loading/error hook OEE —
// dipakai tiap widget halaman OEE untuk skeleton / pesan kosong / error
// (Guide §5, gap G17). Dipecah dari useOeeAnalytics.ts mengikuti pola
// R9.2 agar hook tetap di bawah batas keras kontrak direktori.
// ---------------------------------------------------------------------------

type QueryStub = Parameters<typeof toWidgetState>[0];

function stubQuery(
  overrides: {
    isLoading?: boolean;
    isError?: boolean;
    refetch?: () => Promise<unknown>;
  } = {}
): QueryStub {
  return {
    isLoading: false,
    isError: false,
    refetch: async () => undefined,
    ...overrides,
  } as unknown as QueryStub;
}

test('toWidgetState meneruskan isLoading/isError dari query', () => {
  const loading = toWidgetState(stubQuery({ isLoading: true }));
  assert.equal(loading.isLoading, true);
  assert.equal(loading.isError, false);

  const failed = toWidgetState(stubQuery({ isError: true }));
  assert.equal(failed.isLoading, false);
  assert.equal(failed.isError, true);

  const ready = toWidgetState(stubQuery());
  assert.equal(ready.isLoading, false);
  assert.equal(ready.isError, false);
});

test('toWidgetState.refetch memanggil refetch query', () => {
  let called = 0;
  const state = toWidgetState(
    stubQuery({
      refetch: async () => {
        called += 1;
        return undefined;
      },
    })
  );
  state.refetch();
  assert.equal(called, 1);
});

test('combineQueryStatus: false bila semua query tenang', () => {
  const combined = combineQueryStatus([stubQuery(), stubQuery(), stubQuery()]);
  assert.deepEqual(combined, { isLoading: false, isError: false });
});

test('combineQueryStatus: true bila SATU SAJA query memuat/gagal', () => {
  const loading = combineQueryStatus([
    stubQuery(),
    stubQuery({ isLoading: true }),
    stubQuery(),
  ]);
  assert.deepEqual(loading, { isLoading: true, isError: false });

  const failed = combineQueryStatus([
    stubQuery(),
    stubQuery(),
    stubQuery({ isError: true }),
  ]);
  assert.deepEqual(failed, { isLoading: false, isError: true });
});

// ---------------------------------------------------------------------------
// E12 T12.16 (F-12 / FAT-68): `isRefreshing` halaman OEE harus mencakup
// keenam query — termasuk overlay downtime (useInfiniteQuery) dan pareto —
// agar spinner Refresh tidak berhenti padahal data masih dimuat (gap G10).
// ---------------------------------------------------------------------------

type FetchingStub = Parameters<typeof combineIsRefreshing>[0][number];

function fetchingStub(isFetching: boolean): FetchingStub {
  return { isFetching } as FetchingStub;
}

test('combineIsRefreshing: false bila keenam query halaman tenang', () => {
  assert.equal(
    combineIsRefreshing([
      fetchingStub(false), // shift summary
      fetchingStub(false), // hourly
      fetchingStub(false), // timeline
      fetchingStub(false), // downtime overlay (useInfiniteQuery)
      fetchingStub(false), // rollup
      fetchingStub(false), // reject pareto
    ]),
    false
  );
});

test('combineIsRefreshing: true bila pareto masih memuat', () => {
  assert.equal(
    combineIsRefreshing([
      fetchingStub(false),
      fetchingStub(false),
      fetchingStub(false),
      fetchingStub(false),
      fetchingStub(false),
      fetchingStub(true), // reject pareto
    ]),
    true
  );
});

test('combineIsRefreshing: true bila overlay downtime masih memuat (termasuk halaman berikut)', () => {
  // Overlay adalah useInfiniteQuery: `isFetching`-nya true saat refetch
  // maupun saat "Muat lebih banyak" (`isFetchingNextPage` adalah subset
  // `isFetching`), jadi satu flag ini sudah mencakup kedua kasus.
  assert.equal(
    combineIsRefreshing([
      fetchingStub(false),
      fetchingStub(false),
      fetchingStub(false),
      fetchingStub(true), // downtime overlay
      fetchingStub(false),
      fetchingStub(false),
    ]),
    true
  );
});
