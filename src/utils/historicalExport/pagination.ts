import { CursorPageResponse } from '../../types/historical';
import { DEFAULT_HISTORY_PAGE_LIMIT } from './constants';

function encodeOpaqueCursor(ts: string, id: string): string {
  const json = JSON.stringify({ t: ts, id });
  if (typeof btoa === 'function') {
    return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return Buffer.from(json, 'utf8').toString('base64url');
}

function decodeOpaqueCursor(cursor: string): { t: string; id: string } | null {
  try {
    let raw: string;
    if (typeof atob === 'function') {
      const padded = cursor.replace(/-/g, '+').replace(/_/g, '/');
      raw = atob(padded);
    } else {
      raw = Buffer.from(cursor, 'base64url').toString('utf8');
    }
    const parsed = JSON.parse(raw) as { t?: string; id?: string };
    if (parsed.t && parsed.id) return { t: parsed.t, id: parsed.id };
    return null;
  } catch {
    return null;
  }
}

/**
 * Server-side cursor pagination simulation in descending timestamp order (`ts DESC, id DESC`).
 * Cursors are opaque Base64URL tokens on the wire (Build Guide §4.7).
 */
export function paginateWithCursor<T>(
  items: T[],
  getTimestamp: (item: T) => string,
  options: { cursor?: string | null; limit?: number; maxLimit?: number; getId?: (item: T) => string } = {}
): CursorPageResponse<T> {
  const maxLimit = options.maxLimit ?? 100;
  const limit = Math.max(1, Math.min(maxLimit, options.limit ?? DEFAULT_HISTORY_PAGE_LIMIT));
  const getId =
    options.getId ??
    ((item: T) => {
      const rec = item as Record<string, unknown>;
      return String(rec.id ?? rec.wo_id ?? rec.machine_id ?? rec.product_id ?? '');
    });

  const sorted = [...items].sort((a, b) => {
    const diff = new Date(getTimestamp(b)).getTime() - new Date(getTimestamp(a)).getTime();
    if (diff !== 0) return diff;
    return getId(b).localeCompare(getId(a));
  });

  let startIndex = 0;
  if (options.cursor) {
    const decoded = decodeOpaqueCursor(options.cursor);
    if (decoded) {
      const idx = sorted.findIndex(
        (item) => getTimestamp(item) === decoded.t && getId(item) === decoded.id
      );
      if (idx >= 0) {
        startIndex = idx + 1;
      } else {
        const afterIdx = sorted.findIndex(
          (item) => new Date(getTimestamp(item)).getTime() < new Date(decoded.t).getTime()
        );
        startIndex = afterIdx >= 0 ? afterIdx : sorted.length;
      }
    }
  }

  const pageItems = sorted.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + pageItems.length < sorted.length;
  const lastItem = pageItems[pageItems.length - 1];
  const nextCursor =
    hasMore && lastItem ? encodeOpaqueCursor(getTimestamp(lastItem), getId(lastItem)) : null;

  return {
    data: pageItems,
    pagination: {
      limit,
      next_cursor: nextCursor,
      has_more: hasMore,
      truncated: hasMore,
      total_count: sorted.length,
    },
  };
}
