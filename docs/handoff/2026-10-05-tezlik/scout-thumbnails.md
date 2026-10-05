The page is not published: this is a hand-back to the calling workflow, not a deliverable for other readers.

# Grid thumbnails: findings and recommendation

**Recommendation: (D) imgproxy on the Tashkent server, installed with a new narrow workflow action — not by re-running setup.sh.** All 8 live post images, shrunk to fit 640×640 at WebP quality 70, went from 2111 KB to 318 KB (85% smaller). Image processing stays in Uzbekistan, and every old post gets thumbnails with no backfill.

## What I measured (read-only)
- **(A) is switched off for the zone.** `GET https://nfcstore.uz/cdn-cgi/image/width=480,quality=75,format=auto/uploads/f9dd20f2732756622ede.jpg` returns Cloudflare's own 404 page. Image Transformations is not enabled for nfcstore.uz.
- **s3.nfcstore.uz goes straight to the server.** It answers with `via: 1.1 Caddy` and no Cloudflare proxy. Unsigned requests get 403, because the Garage bucket is private.
- **Post images on the live site:**

| File | Original | Thumbnail (fit 640×640, WebP q70) |
|---|---|---|
| 941×1672 | 573 KB | 360×640, 70 KB |
| 1086×1448 | 489 KB | 480×640, 83 KB |
| 820×820 | 124 KB | 640×640, 30 KB |

  - The same 8 images as JPEG q72 come to 389 KB.
  - EXIF orientation was 0 or missing on these files.
  - I deleted the local copies afterwards.
- **App grid tile size.** Tiles are decoded at `decodeWidth`, which rounds up to multiples of 120 px (`media_frame.dart:78-83`). With a tile of (screen − 40 − 12)/3 (`profile_screen.dart:1677`), that is about 360 px on a 390 pt phone and 480 px on a 430 pt phone. Fitting inside 640×640 gives a short side of 480 for 3:4 and 4:3 photos and 360 for 9:16, which is enough.
- **Request counts (from the IAD colo, cold worker):**
  - `/api/feed`: 2 rounds.
  - `/api/records/OAO777/posts`: 3 rounds.
  - `/api/companies/NFCSTOREUZ/posts`: **9 rounds** (5 `ALTER` plus 5 `PRAGMA company_catalog_items`, then sequential `SELECT`s of companies, users, companies and company_posts). This has nothing to do with thumbnails but is worth fixing separately.

## Code facts the options depend on
- **App upload path.** Post images go through `uploadImage`: `prepareImageForUpload` (`image_prep.dart:24-26,31-58`; only files over 400 KB are re-encoded, long side capped at 1600 px, quality 85), then a base64 POST to `/api/upload` (`profile_repository.dart:224-245`).
- **Server upload checks.** Every image is checked by `moderateImage` (`worker.js:7477`) and gets a random flat name `<20hex>.<ext>` (`worker.js:7483`). The streaming path names files `${prefix}_${hex24}.${ext}` (`worker.js:7068`). There is a daily quota (`6817-6857`) and a limit of 40 uploads per hour (`worker.js:7321`).
- **Accepted post image paths.** Company posts must match `UPLOAD_IMAGE_PATH_RE` (`worker.js:3046`, flat names only), used by `storyMediaD1` (`3049`). Personal posts use a looser `/uploads/` check (`worker.js:6476`).
- **Tables.** `posts` and `company_posts` have only `image_url` and `video_url`, with no thumbnail column (`worker.js:1496`, `6496`).
- **API responses.** `postRowToJson` (`worker.js:10704`), the company posts response (`1435-1442`) and the feed (`11068-11082`) only return `imageUrl` and `videoUrl`.
- **Serving `/uploads/*`.** `serveUpload` (`worker.js:7564-7700`) checks the edge cache keyed on `uploadEdgeKey` (`7535-7540`). On a miss it does one `get` and splits the stream between the user and the cache (`7609-7637`). Originals are sent with `public, max-age=31536000, immutable` (`6777`). The router sends all of `/uploads/*` there (`11795`).
- **Garage reads.** `uzBucket` signs requests to https://s3.nfcstore.uz with `cache:'no-store'` (`uz-store.js:406-433`).
- **Files are deleted in 5 places:** `worker.js:3112` and `7308`, `api/account-purge.js:750`, `api/media.js:408`, `api/music.js:151`. Any thumbnail stored as its own file must be added to all five.
- **App grid.** One grid serves both personal and company profiles: `profile_screen.dart:1777` (`mediaImage(context, p.mediaUrls.first, ...)`). Video tiles use `VideoPoster` (`1747`), which opens a player to grab the first frame. `Post.fromJson` (`models.dart`, around line 1380) does not read any thumbnail field.
- **Website.** `ProfilePage.jsx:898` (`MediaThumb`) and `CompanyPublicPage.jsx:108` (`<img src={p.imageUrl}>`) also load full-size originals.

## Is re-running setup.sh on the live server safe?
**Data and secrets are safe, but it is not safe for uptime. Do not re-run it to add imgproxy.**
- **Kept as they are:**
  - `secrets.env` is only created if missing (62-69).
  - `s3.env` and the Garage key are only created if missing (174-182).
  - Bucket creation (173) and layout assignment (169-171) are guarded.
  - `mkdir -p` (60) touches no data, and `garage.toml` is rebuilt from the same secrets (78-96).
- **What it disrupts:**
  - **Docker restart:** `systemctl restart docker` (57) runs every time and restarts sqld, garage and caddy. Production DB and media go down for tens of seconds.
  - **Package upgrades:** `apt-get update` and `install` (43-44) can upgrade docker.io, which restarts Docker again. `dpkg --configure -a` (41) and an AppArmor restart (48-53) can also run.
  - **Database version:** `SQLD_IMAGE=...libsql-server:latest` (24) is pulled (158), and `up -d` (162) recreates sqld on an untested version. `caddy:2` also floats; Garage is pinned to v1.1.0 (23).
  - **Caddyfile and compose file overwritten:** both are rewritten from the templates (98-145), so manual additions on the server are lost.
- **No partial run is possible:** the workflow runs the whole script in the background (`uz-server.yml:98-122`).

## The four options

### (A) Cloudflare Image Transformations
- **Status:** off for the zone (the 404 above).
- **To enable:** the owner turns it on in the dashboard, or a Worker `images` binding is added to `wrangler.jsonc`.
- **Source images:**
  - `/cdn-cgi/image` would have to fetch `/uploads/*`, which only the Worker serves.
  - `fetch` with `cf.image` would need a presigned Garage URL; `uz-store.js` currently only signs headers.
  - The binding can read straight from Garage instead.
- **Code:** about 3 files (Worker, wrangler config, clients).
- **Cost:** from Cloudflare's published pricing, which I could not check from here, there is a monthly free allowance of 5,000 unique transformations; our need is about 0.5–1k. With the recent "payments failed" block, enabling it or staying within the allowance is not guaranteed.
- **What breaks:** if the feature is disabled or over quota, every thumbnail falls back to the original.
- **Law 547:** resizing happens outside UZ. It is temporary, like today's edge caching.
- **Coverage:** old posts yes, website yes.
- **Rollback:** a flag.

### (B) App makes a small copy, plus a backfill
- **Code:** about 12–15 files.
  - App: `image_prep.dart`, `profile_repository.dart`, `post_screens.dart`, `models.dart`, `profile_screen.dart`, and a fix to the business grid.
  - Worker: 2 create endpoints, 3+ read endpoints, `ADD COLUMN thumb_url` on both tables, and the 5 delete sites.
  - Website upload and grid, plus a backfill script.
- **What breaks or gets worse:**
  - Each post means 2 moderation calls to Gemini (`7477`), and the hourly limit effectively drops to 20 posts (`7321`).
  - A thumbnail can be uploaded while the original fails, leaving orphans.
  - A client can set `thumbUrl` to any `/uploads/` file. Nothing checks ownership today (`6476`).
  - Older app builds never send thumbnails.
- **Law 547:** a backfill on a GitHub runner exports about 490 user photos out of UZ. The backfill would have to run on the server instead, and it writes to the production DB.
- **Coverage:** old posts only after the backfill. The website only benefits if site uploads also make thumbnails.
- **Rollback:** clients ignore an empty `thumbUrl`; the columns and files stay.
- **Plus side:** the same mechanism could later carry video posters.

### (C) Worker resizes on demand with WASM
- **CPU:** decoding a 1600 px JPEG, resizing and encoding WebP takes an estimated 60–120 ms of CPU. The free Workers plan allows 10 ms, so it would fail with error 1102. The plan is unknown, and the payment issue could cause a downgrade.
- **Technical gaps:**
  - The WASM codecs (jsquash/photon) ignore EXIF orientation, so photos can come out sideways.
  - No GIF or HEIC support.
  - The vite/worker build needs `.wasm` module rules.
  - Several decodes at once share the 128 MB limit.
- **Storage:** saving results in Garage needs the 5 delete hooks. Without saving, every colo recomputes.
- **Code:** about 3–4 files plus new dependencies.
- **Law 547:** processing is at the edge, temporary.
- **Coverage:** old posts yes, website yes.
- **Rollback:** a flag.

### (D) imgproxy/libvips on the server (recommended)
- **Law 547:** resizing happens in Tashkent, reading Garage over the local Docker network. Only the derived thumbnail reaches the edge cache, just as originals do today.
- **Cost:** $0.
- **Coverage:** old posts and the website get thumbnails immediately.
- **Format handling:** libvips decodes JPEG at reduced size, auto-rotates using EXIF and strips metadata.
- **Server memory:** capped at 384 MB on a 2 GB machine with about 800 MB used.
- **Nothing new is stored,** so the delete code stays as is. Thumbnails stay in the edge cache for 7 days, versus 1 year (`immutable`) for originals today.
- **Downsides:**
  - It changes the live server, though only by adding one container and a graceful Caddy reload.
  - The open-source imgproxy cannot make video posters.
- **Code:** about 7 files (listed below).
- **Rollback:** set `THUMBS=off`.

## Implementation plan for (D)

### 1. Server: `ops/uz-server/imgproxy.sh` plus a new `uz-server.yml` action `imgproxy`
Never run `setup.sh`, apt, or `systemctl restart docker` for this.
1. **Secrets.** If `/srv/nfcstore/imgproxy.env` is missing, create it with umask 077 holding `IMGPROXY_KEY` and `IMGPROXY_SALT` (`openssl rand -hex 32` each).
2. **Read-only Garage key.**
   - Run `garage key create nfcstore-imgproxy`, then `garage bucket allow --read nfcstore-uploads --key nfcstore-imgproxy`.
   - Append the key to `imgproxy.env` as `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
   - Never print it; reuse the workflow's existing log filter.
3. **Compose override file.** Write `/srv/nfcstore/docker-compose.override.yml`. Plain `docker compose` merges it automatically, so a later full setup run keeps it.
   - **Image and limits:**
     - Image: a pinned imgproxy v3 tag or digest.
     - Memory 384 MB, 1 CPU, read-only filesystem with tmpfs `/tmp`.
     - No published ports.
   - **Garage source settings:**
     - `IMGPROXY_USE_S3=true`
     - `IMGPROXY_S3_ENDPOINT=http://garage:3900`
     - `IMGPROXY_S3_REGION=garage` (must match `setup.sh:88`)
     - `IMGPROXY_ALLOWED_SOURCES=s3://nfcstore-uploads/uploads/`
   - **Limits:**
     - `IMGPROXY_MAX_SRC_RESOLUTION=40`
     - `IMGPROXY_MAX_SRC_FILE_SIZE=26214400`
     - `IMGPROXY_WORKERS` (also known as `CONCURRENCY`) `=2`
     - `IMGPROXY_MAX_CLIENTS=16`
     - `IMGPROXY_DOWNLOAD_TIMEOUT=8`
     - `IMGPROXY_TIMEOUT=10`
   - **Output:**
     - `IMGPROXY_USE_ETAG=true`
     - `STRIP_METADATA` and `AUTO_ROTATE` left at their defaults (on)
     - `MALLOC_ARENA_MAX=2`
4. **Caddy route.** Rewrite the `{$S3_HOST}` block in place (use `cat >`, not `sed -i`; the file is a single-file bind mount, `setup.sh:141`):
   ```
   request_body { max_size 250MB }
   handle_path /_img/* { reverse_proxy imgproxy:8080 }
   handle { reverse_proxy garage:3900 }
   ```
   Bucket names cannot start with `_`, so `/_img/` cannot clash with S3 paths.
5. **Start only imgproxy.**
   - Run `docker compose up -d --no-deps imgproxy`.
   - Check `caddy validate`, then `caddy reload` (atomic: a bad config keeps the old one).
   - Health check: `docker compose exec -T caddy wget -qO- http://imgproxy:8080/health`.
6. **Worker secrets.** Read the key and salt from the server and set `IMGPROXY_KEY`, `IMGPROXY_SALT` and `IMGPROXY_URL=https://s3.nfcstore.uz/_img` with `wrangler secret put --name nfcstore-uz`, the same way as `uz-server.yml:168`.
7. **Keep setup.sh in step.** Copy the same Caddyfile block into `setup.sh:107-112`. Separately, pin `SQLD_IMAGE` (24) and make line 57 conditional.

### 2. Worker: `hosting/worker.js`
- **New flag:** `THUMBS` (`on`/`off`) in the `wrangler.jsonc` vars.
- **URL scheme.** `/uploads/w/640/<name>`, where `<name>` is the original file name. Only this one preset exists, so no resize parameters come from the client.
  - Path pattern: `/^\/uploads\/w\/640\/([A-Za-z0-9][A-Za-z0-9_-]{0,120}\.(?:jpe?g|png|webp))$/i` (GIFs and videos excluded).
  - Every stored name is flat, so `uploads/w/...` can never be a real file.
- **`thumbUrlFor(imageUrl)`.** Takes the path from relative or own-domain URLs. It returns '' when `THUMBS` is off or the name is not allowed. Add `thumbUrl` to:
  - `postRowToJson` (10704)
  - the company posts response (1435-1442)
  - the feed (11068-11082)

  It is pure string work, so it adds no DB rounds.
- **`serveThumb(request, env, url, ctx)`.** Route it before line 11795.
  1. Path does not match: 404.
  2. Flag off or secrets missing: call `serveUpload` with `/uploads/<name>` (the original).
  3. Edge cache, keyed on `url.origin + url.pathname`:
     - On a hit, answer `If-None-Match` with 304, as `7590-7598` does.
     - On a miss, use an in-isolate map so simultaneous misses share one fetch (same idea as `uploadVideoFilling`, `7550`).
  4. Signed imgproxy request:
     - Path: `/rs:fit:640:640:0/q:70/<base64url("s3://nfcstore-uploads/uploads/<name>")>.webp`
     - Signature: base64url(HMAC-SHA256(hex(key), hex(salt) + path)) via `crypto.subtle`.
     - Fetch with `cache:'no-store'` and `AbortSignal.timeout(4000)`.
  5. 200 response: split the stream, one copy to the user and one to `ctx.waitUntil(caches.default.put(...))`, as `7618-7623` does.
     - User headers: `content-type: image/webp`, `cache-control: public, max-age=2592000`, the etag, and `x-nfc-thumb: miss` or `hit`.
     - The cached copy stores `cache-control: public, max-age=604800`.
  6. 404 from imgproxy: return 404.
  7. Anything else (timeout, 5xx, container down): serve the original via `serveUpload` with `x-nfc-thumb: fallback`. Do not cache it, or cache for 60 s at most.
- **Tests:**
  - The path pattern rejects `..`, `%2e`, nested paths, `.gif` and `.mp4`.
  - A known-answer test for the signature.
  - The fallback when `fetch` throws.
  - The header values.

### 3. Abuse and DoS protection
- **Bounded work:** one fixed preset and flat names only; the Worker builds and signs every URL.
- **imgproxy is not an open proxy:** it rejects unsigned URLs and only reads `s3://nfcstore-uploads/uploads/`.
- **Resource caps:** at most 2 resizes at a time, a memory cap so sqld cannot be OOM-killed, and source size/resolution limits.
- **Repeat work limited:** each colo resizes an image at most once per 7 days.
- **Random names are cheap:** a made-up name costs one Garage 404.
- **Not exposed directly:** the container has no host port.

### 4. Clients
- **App:**
  - `models.dart`: add `Post.thumbUrl`, parsed with `mediaUrl()`, and keep it in `copyWith`.
  - `profile_screen.dart:1777`: use `p.thumbUrl.isNotEmpty ? p.thumbUrl : p.mediaUrls.first`.
  - Package and applicationId do not change.
  - Older builds ignore the field.
- **Website:**
  - `MediaThumb.jsx`: use `item.thumbUrl` for images and retry with the original on error.
  - `CompanyPublicPage.jsx:108`: use `p.thumbUrl || p.imageUrl`.
- **Later, optional:**
  - Feed and discover tiles (a 1080 preset).
  - Catalog images (`discover_cards.dart:818`).

### 5. Rollout and rollback
- **Order:**
  1. Run the server action and check that signed requests return WebP and unsigned ones return 403.
  2. Deploy the Worker with `THUMBS=off`; the route then just serves originals.
  3. Switch `THUMBS=on` and check `curl -I /uploads/w/640/4bf8146e4ae79927156f.jpg`: `x-nfc-thumb` goes from miss to hit and the size is about 36 KB. Posts JSON should now include `thumbUrl`, with the same number of DB rounds.
  4. Update the website, then the app build.
- **Rollback:**
  - `THUMBS=off`: the API stops returning `thumbUrl` and `/uploads/w/*` serves originals.
  - On the server: `docker compose stop imgproxy`, restore the S3 block, `caddy reload`.

## Not covered
Video tiles still need posters. imgproxy's video-frame feature is not in the open-source version. A follow-up would have the app upload the first frame that `VideoPoster` already grabs, plus a one-time ffmpeg run on the server for existing `cardvid_*` files.

Files referenced:
- /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/mainwt2/hosting/worker.js
- /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/mainwt2/hosting/uz-store.js
- /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/mainwt2/ops/uz-server/setup.sh
- /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/mainwt2/.github/workflows/uz-server.yml
- /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/mainwt2/wrangler.jsonc
- /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/mainwt2/src/components/MediaThumb.jsx
- /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/mainwt2/src/pages/CompanyPublicPage.jsx
- /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/bio2/mobile_nova/lib/core/media/image_prep.dart
- /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/bio2/mobile_nova/lib/features/profile/profile_repository.dart
- /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/bio2/mobile_nova/lib/features/profile/profile_screen.dart
- /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/bio2/mobile_nova/lib/features/social/media_frame.dart
- /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad/bio2/mobile_nova/lib/data/models/models.dart