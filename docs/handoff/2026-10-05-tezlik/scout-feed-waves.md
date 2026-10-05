**Logged-in `GET /api/feed` feed: why 3 DB waves, and a change that makes it 2**

The logged-in feed takes 3 waves because the main feed query asks for the viewer's id at three spots, all only for the `liked` flags. The blocked-users list and the "hide blocked, then cut to `limit`" step that feeds the shaping both wait for the viewer too. So the order is forced: session, then page rows and blocks, then shaping. I made the change in a scratch copy (main is untouched). Logged-in warm goes from 3 to 2 waves, output is identical to current code, and all feed gates pass in both D1 and sqld mode. 1 wave is not safe (see section 3).

### 1. Wave trace, logged-in, warm isolate (line numbers are current main)
- **Before any wave:** `coreApi` awaits `ensureCoreSchema` (`worker.js:11369`). On a warm isolate this costs nothing (`worker.js:2263-2266`, cached results). On a new isolate it costs one wave: `SELECT maintenance_runs` plus `BATCH(3)` (`worker.js:2232-2253`).
- **Wave 1:** `feedApi` waits on `getCurrentUser` (`worker.js:11097`). That function hashes the token (`worker.js:3382`) and then runs one sessions⋈users `.first()` (`worker.js:3383-3399`). In `x-nfc-sql` this shows up as "SELECT bot_verifications", because the label is taken from the first FROM (inside the EXISTS).
  - The 2% expired-sessions DELETE (`worker.js:3378`) rides along in this wave.
  - An old raw-token session adds one awaited UPDATE wave, once per such session (`worker.js:3400-3402`).
  - Nothing else starts before this finishes: `featuredP` and the comments schema check (`worker.js:11110-11111`) come after it.
- **Wave 2 (`worker.js:11112-11119`):**
  - The main query binds `viewerId` for the `liked` EXISTS at `worker.js:10997`, `11013` and `11023`. Company posts hard-code 0 (`worker.js:11005`).
  - `apiModeration.blockedByUser` (`api/moderation.js:114-121`).
  - `apiFeatured.activeTargets` (`api/featured.js:159-170`).
- **Wave 3:**
  - The blocked filter (`worker.js:11130-11135`) and the page slice (`worker.js:11143`) feed `shapeFeedRows(page1)` (`worker.js:11145`, which calls `11047-11059`).
  - That runs four lookups together: `countsFor` (`api/comments.js:526`), `viewsFor` (`:572`), `likesFor` (`:544`) and `attachPostExtras` (`api/music.js:270`).
- **When a featured slot is active:** the featured rows query (`worker.js:11168-11176`) joins wave 3, and `shapeFeedRows(featured)` (`worker.js:11188`) adds wave 4.
- **Anonymous:** `getCurrentUser` returns null at `worker.js:3375` without touching the DB, so it is 2 waves.
  - Live from IAD, warm: `1:SELECT post_likes | 1:SELECT featured_slots | 2:SELECT post_extras | 2:content_comments | 2:content_view_hits | 2:content_likes`.
  - Live, new isolate: 3 waves, about 1.5 s: `1:BATCH(3)+maintenance_runs | 2:BATCH(4)+post_likes+maintenance_runs | 3:...`.

### 2. The change
- **Wave 1:** the session lookup, the main query and featured targets run together. The main query binds 0 for the viewer, so it is exactly the anonymous query.
- **Wave 2:** blocks, one new liked-flags query and the shaping run together. Shaping covers all `limit+1` rows. Blocked rows are dropped and the `liked` flag is set afterwards, then the list is cut to `limit`. Each row is shaped on its own, so the result is identical.
- Featured rows also move into wave 2.

Full patch, checked against main with `git apply --check -p1` (applies cleanly): `/tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/feed-waves.patch`

Exact replacements in `hosting/worker.js`:

**R1** OLD:
```
async function feedApi(request, env, url) {
  if (url.pathname !== '/api/feed' || request.method !== 'GET') return null;

  const user = await getCurrentUser(request, env);
  const viewerId = user ? user.id : 0;
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
```
NEW:
```
const feedLikedKey = (r) => {
  const t = commentTargetKind(r);
  if (t === 'company_post') return null;          // liked comes from content_likes (shapeFeedRows/likesFor)
  return `${t === 'post' ? 'post' : 'story'}:${Number(r.id)}`;
};

// Same predicates as the EXISTS in FEED_UNION_SQL. Errors NOT swallowed (a false liked:false would make the toggle UNLIKE).
async function feedViewerLikedKeys(env, rows, viewerId) {
  const postIds = [];
  const storyIds = [];
  for (const r of rows) {
    const k = feedLikedKey(r);
    if (k) (k.startsWith('post:') ? postIds : storyIds).push(Number(r.id));
  }
  const parts = [];
  const args = [];
  if (postIds.length) {
    parts.push(`SELECT 'post' AS kind, post_id AS id FROM post_likes
                 WHERE user_id = ? AND post_id IN (${postIds.map(() => '?').join(',')})`);
    args.push(viewerId, ...postIds);
  }
  if (storyIds.length) {
    parts.push(`SELECT 'story' AS kind, story_id AS id FROM story_likes
                 WHERE user_id = ? AND story_id IN (${storyIds.map(() => '?').join(',')})`);
    args.push(viewerId, ...storyIds);
  }
  if (!parts.length) return new Set();
  const res = await env.DB.prepare(parts.join(' UNION ALL ')).bind(...args).all();
  return new Set((res.results || []).map((x) => `${x.kind}:${Number(x.id)}`));
}

async function feedApi(request, env, url) {
  if (url.pathname !== '/api/feed' || request.method !== 'GET') return null;

  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
```

**R2** OLD:
```
  const [rows, blockedList] = await Promise.all([
    env.DB.prepare(
      `${FEED_UNION_SQL}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    ).bind(viewerId, viewerId, now, viewerId, now, limit + 1, offset).all(),
    viewerId ? apiModeration.blockedByUser(env, viewerId) : [],
  ]);
```
NEW:
```
  const [user, rows] = await Promise.all([
    getCurrentUser(request, env),
    env.DB.prepare(
      `${FEED_UNION_SQL}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    ).bind(0, 0, now, 0, now, limit + 1, offset).all(),
  ]);
  const viewerId = user ? user.id : 0;
  const raw = rows.results || [];

  const featuredRowsP = (async () => {
    const targets = (await featuredP) || [];
    if (!targets.length) return { targets, rows: [] };
    const where = targets.map(() => '(kind = ? AND id = ?)').join(' OR ');
    const fRows = await env.DB.prepare(
      `${FEED_UNION_SQL} WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT 10`
    ).bind(
      viewerId, viewerId, now, viewerId, now,
      ...targets.flatMap((t) => [t.kind.endsWith('story') ? 'story' : 'post', t.id]),
    ).all().catch(() => null);
    return { targets, rows: fRows?.results || [] };
  })();

  const [blockedList, likedKeys, shapedAll] = await Promise.all([
    viewerId ? apiModeration.blockedByUser(env, viewerId) : [],
    viewerId ? feedViewerLikedKeys(env, raw, viewerId) : null,
    shapeFeedRows(env, raw, viewerId),
  ]);
```

**R3** OLD:
```
  const all = (rows.results || []).filter(
    (r) => !blocked.has(`${String(r.author_kind)}:${String(r.code || '').toUpperCase()}`),
  );
```
NEW:
```
  const all = [];
  raw.forEach((r, i) => {
    if (blocked.has(`${String(r.author_kind)}:${String(r.code || '').toUpperCase()}`)) return;
    const k = likedKeys && feedLikedKey(r);
    all.push(k ? { ...shapedAll[i], liked: likedKeys.has(k) } : shapedAll[i]);
  });
```

**R4** OLD:
```
  const page1 = all.slice(0, limit);
  // Sahifa va FEATURED parallel shakllanadi (pastdagi izohga qarang).
  const feedPromise = shapeFeedRows(env, page1, viewerId);
```
NEW:
```
  const feed = all.slice(0, limit);
```

**R5** OLD (from `const targets = (await featuredP) || [];` through `const fFiltered = (fRows?.results || []).filter((r) => {`, i.e. `worker.js:11165-11178`):
```
    const targets = (await featuredP) || [];
    if (targets.length) {
      const where = targets.map(() => '(kind = ? AND id = ?)').join(' OR ');
      const fRows = await env.DB.prepare(
        `${FEED_UNION_SQL} WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT 10`
      ).bind(
        viewerId, viewerId, now, viewerId, now,
        // FEATURED `target_kind` izoh turlarini ishlatadi
        // (`company_post`), UNION esa `kind` + `author_kind`
        // juftligini — shuning uchun moslashtiriladi.
        ...targets.flatMap((t) => [t.kind.endsWith('story') ? 'story' : 'post', t.id]),
      ).all().catch(() => null);

      const fFiltered = (fRows?.results || []).filter((r) => {
```
NEW:
```
    const { targets, rows: fRowList } = await featuredRowsP;
    if (targets.length) {
      const fFiltered = fRowList.filter((r) => {
```

**R6:** delete the line `  const feed = await feedPromise;` at `worker.js:11193`.

**Optional, recommended: new-isolate fix.** `api/moderation.js:116` and `api/featured.js:160` run the table-creation batch and wait for it before their SELECT. That costs one extra wave on every new isolate. In each function, replace `await ensureSchema(env);` with `const ready = ensureSchema(env);`, and add `await ready;` right after the `....all().catch(() => null);` line:
- On sqld, the create-table batch is sent first in the same request, so it still runs before the SELECT.
- On D1, if the table does not exist yet, the existing catch returns `[]`, which is correct: no table means no blocks and no slots.

### 3. Measured in the scratch harness (sqld fake with 25 ms per call, real worker code)

| Case | Before | After |
|---|---|---|
| Logged-in, warm | 3 | 2 |
| Logged-in, page 2 | 3 | 2 |
| Logged-in, featured slot active | 4 | 3 |
| Logged-in, new isolate (feed change only) | 5 | 4 |
| Logged-in, new isolate (with optional fix) | 5 | 3 |
| Anonymous | 2 | 2 (unchanged) |
| Anonymous, featured slot active | 3 | 3 (unchanged) |

- The new wave 2 went out as a single HTTP request.
- I compared current and patched code on the same database: 126 of 126 JSON responses were identical. That covered:
  - anonymous, a viewer with record and company blocks (including a lowercase id), an old raw token, deleted, suspended, expired and bad tokens;
  - limits 5, 7, 15 and 30 over several pages, with and without featured slots, with matching ids across posts, company posts and stories, and 7 liked items.
- Expected live effect: about one Warsaw–Tashkent round trip less, so the 283 ms logged-in feed should drop to roughly 210 ms.
- 1 wave is not safe. It would mean copying the session validity rules into SQL (hashed or raw token, expiry, `deleted_at`, `suspended_until` read with `parseDbDate`). It would also mean moving comment, view, company-like and music lookups into the main query.

### 4. Risk
- **Timing of `liked`:** it is now read in its own query, about one round trip after the page rows. A like toggled in that roughly 70 ms window could briefly disagree with `likeCount`. Current code already has the same gap for comment, view and company-like counts.
- **Shaping one extra row:** `limit+1` rows (plus any blocked ones) are shaped, so each of the four lookups gets one more id. The output is unchanged.
- **Errors from the liked query:** they return 503 on purpose, just as a failed main query does today. Swallowing them would show `liked:false`, and tapping the heart would then unlike (`worker.js:10790-10795`).
- **Session query as a separate request:** in Node the session SELECT went out as its own concurrent request, because `crypto.subtle.digest` resolves after the 16-microtask-hop collection window. That costs at most one extra subrequest and no extra latency. `follow-stats` already uses the same pattern (`worker.js:11288-11294`), and the profile measures 1 wave live.
- **No schema or migration change:** `FEED_UNION_SQL` is untouched, and the anonymous query is the same as today. The privacy filters (hidden, deleted owner, company status, not demo, blocks, featured slot checks) are unchanged.

### 5. Gate scripts to run after the change (run each plain and with `UZ_ADAPTER_TEST=1`)
All passed on the patched copy:
- **Call `/api/feed` through the worker:**
  - `scripts/test-featured.mjs` (logged in, featured, block and unblock, hidden profile; `deploy.yml:148`)
  - `scripts/test-deleted-user-content.mjs` (`deploy.yml:227`)
  - `scripts/test-comment-moderation.mjs` (`deploy.yml:103`)
  - `scripts/test-content-views.mjs` (`deploy.yml:174`, plus the UZ loop at `:98`)
  - `scripts/test-post-music.mjs` (`deploy.yml:294`)
  - `scripts/test-demo-businesses.mjs` (`deploy.yml:304`)
  - `scripts/test-uz-cold-start.mjs` (anonymous, request count on a new isolate; `deploy.yml:97`)
- **Static route checks:** `scripts/api-route-reachability-test.mjs`, `scripts/test-noop-audit.mjs`.
- **For the moderation/featured part:** `scripts/moderation-test.mjs`, `scripts/test-account-deletion.mjs`.
- **Gap:** no gate checks `liked` for a logged-in viewer in `/api/feed`. I'd add one to `test-featured.mjs` section 20: B likes a post and a story, then B's feed shows `liked:true` and the anonymous feed shows false.

### 6. Other things in the feed path
- **Existing pagination bug (not changed):** blocked authors are removed after `LIMIT limit+1` (`worker.js:11116`, `11133`, `11198`). A viewer who blocks someone gets short pages and `hasMore:false` too early. In the harness, a viewer who blocked one author got 8 items and `hasMore:false` while more eligible posts existed. Fixing it means filtering blocks in SQL, which changes results, so it belongs in its own change.
- **Featured slots active:** shaping the featured rows is still its own wave (`worker.js:11188`). Fetching featured rows in wave 1 with a `featured_slots` subquery and shaping them together with the page would make it 2 waves. No slots are active in production right now.
- **New isolates:** `ensureCoreSchema` costs one wave before any handler; the live first hits from IAD took about 1.5 s with 3 waves. It could be overlapped for GET-only routes, but it is not a cheap change.
- **Old raw-token sessions:** the token-migration UPDATE is awaited (`worker.js:3400-3402`) and could run in the background. It only happens once per such session.

Files are in /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad:
- feed-waves.patch
- feedexp/hosting/worker.js
- feedexp/hosting/api/moderation.js
- feedexp/hosting/api/featured.js
- feedexp/scripts/feed-waves.mjs
- feedexp/scripts/feed-diff.mjs
- feedexp/scripts/feed-cold.mjs