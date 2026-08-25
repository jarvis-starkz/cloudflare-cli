/**
 * @file Cloudflare REST API pagination helper.
 *
 * Cloudflare exposes two common pagination shapes:
 *   (A) Page-based   → result_info: { page, per_page, total_pages, count, total }
 *       params:      ?page=N&per_page=M
 *   (B) Cursor-based → result_info: { cursors: { before, after } }
 *       params:      ?cursor={after}
 *
 * `paginate` auto-detects the shape from the first response and walks
 * subsequent pages sequentially (no aggressive parallelism) to avoid 429.
 *
 * Typical callers:
 *   const all = await paginate(
 *     (p) => api.getZones({ page: p.page, per_page: p.perPage, ...p.params }),
 *     { perPage: 50, getAll: true }
 *   );
 */

/**
 * @template T
 * @param {(cursorOrPage:{page?:number,perPage?:number,cursor?:string,params?:any}) => Promise<{result:T[],result_info:any}|{result:T[],result_info:any}[]}>} fetchOne
 * @param {{getAll?:boolean,page?:number,perPage?:number,params?:any,maxRequests?:number,delayMs?:number}} [opts]
 * @returns {Promise<T[]>}
 */
async function paginate(fetchOne, opts = {}) {
  const perPage = opts.perPage || 50;
  const delayMs = opts.delayMs === undefined ? 200 : opts.delayMs;
  const maxRequests = opts.maxRequests || 1000; // safety cap

  if (!opts.getAll) {
    // Single page — caller handles page/per_page via opts.params.
    const resp = await fetchOne({
      page: opts.page || 1,
      perPage,
      cursor: undefined,
      params: opts.params,
    });
    return (resp && resp.result) ? resp.result : [];
  }

  const collected = [];
  let cursor = undefined;
  let page = 1;
  let requests = 0;

  // eslint-disable-next-line no-constant-condition
  while (requests < maxRequests) {
    requests += 1;
    const resp = await fetchOne({ page, perPage, cursor, params: opts.params });
    const result = (resp && resp.result) ? resp.result : [];
    collected.push(...result);

    const info = resp && resp.result_info;
    if (!info) break;

    // --- Cursor pagination ---
    if (info.cursors && (info.cursors.after || info.cursors.next)) {
      const next = info.cursors.after || info.cursors.next;
      if (!next || result.length === 0) break;
      cursor = next;
      if (delayMs) await sleep(delayMs);
      continue;
    }

    // --- Page pagination ---
    const totalPages = typeof info.total_pages === 'number' ? info.total_pages : 0;
    const current = typeof info.page === 'number' ? info.page : page;
    if (current >= totalPages || result.length === 0) break;
    page = current + 1;
    if (delayMs) await sleep(delayMs);
  }

  return collected;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { paginate, sleep };
