# NFCSTORE app image paths: grid tiles and a thumbnail proposal

The grid already caps decoded memory with `memCacheWidth`, so it does not keep 1600 px bitmaps. Its problem is that it still downloads the full original for every tile. The fix below changes 3 files in the app. It sends the grid tile to a server thumbnail when the post JSON includes one, and quietly falls back to the original on 404 or any other error. **No existing test needs updating.** I applied the patch to a scratch copy only (the real app was not touched): `flutter analyze` found no issues and the full `flutter test test/` run passed (1257 passed, 1 skipped), including 3 new tests.

## 1. Where post and tile images are drawn
App commit 90de82e, paths relative to `mobile_nova/lib/`.

**How URLs are built:** the server sends relative paths like `/uploads/x.jpg`. `core/utils/media_url.dart:42` `mediaUrl()` turns them into `kApiBase + path` and leaves `http(s)://` and `data:` alone. Every media field in `data/models/models.dart` goes through `_u()` (line 25). For posts, `Post.fromJson` (1382) fills `mediaUrls` from `media`/`images`/`mediaUrls`, otherwise from the first non-empty of `imageUrl`/`videoUrl`/`url`. Screens always receive absolute URLs.

**One shared image function:** almost everything calls `mediaImage()` in `features/social/media_frame.dart:138`. It uses one `CachedNetworkImage` (lines 184-194) with:
- `cacheManager: NovaImageCache.manager` (1500 files, 60 days, keep-alive 90 s, no size limit)
- fades of 120 ms in and 60 ms out
- `memCacheWidth: width`
- a placeholder that reuses a smaller copy already in memory (`_placeholder` / `_decodedWidths`)
- a broken-image icon on error

The width comes from `decodeWidth(context, side)` (line 78): the box's larger side × device pixel ratio, rounded up to a multiple of 120 and clamped to 120..1440. AdaptiveMedia uses `screenWidth: true`, which means screen width × pixel ratio.

| Place | Code | How it draws | Width decoded |
|---|---|---|---|
| Profile and company grid `_PostsGrid` (personal and `company:true`) | `profile/profile_screen.dart:1777` | `mediaImage(p.mediaUrls.first, cover)` in a sliver grid with 3 columns, tile side `(W-52)/3` | 390pt@3x: 360 px; 430@3x: 480; Reels tab (4:5): 480 |
| Grid video / Reels tiles | `profile_screen.dart:1747` → `social/video_poster.dart:43` | First frame captured from the mp4 with one player at a time; the server provides no poster | n/a, but it downloads video bytes |
| Demo mosaic | `demo/demo_mosaic.dart:124` | `mediaImage`, bundled assets only | — |
| Home feed | `home/home_screen.dart:1394` → `social/feed_card.dart:166` | `AdaptiveMedia` (screen width), plus `_resolveImage` at line 286 using the same `ResizeImage` key | about 1200 |
| Post detail | `social/post_screens.dart:312` | `AdaptiveMedia(p.mediaUrls.first)` | about 1200 |
| Fullscreen viewer | `social/image_viewer.dart:230` | `mediaImage(contain)` | up to 1440 |
| Reels photo poster | `social/reels_screen.dart:1101,1104` | `mediaImage` twice (blurred fill + contain), same key | up to 1440 |
| Discover | `discover/discover_cards.dart` 383 (avatar), 625 (business cover), 729 (logo), 816 (4 product thumbs), 1107 (`_BizCell`) | `mediaImage` | box size |
| Catalog | `discover/catalog_view.dart:638` `_ProductImage` (2-column grid at 406/456, and the detail PageView), 896 (logo) | `mediaImage` | box size |
| Company storefront | `business/store_catalog.dart:456` (2-column grid at 1024), 344 (category chip); `business/business_screens.dart` 530, 615 | `mediaImage` | box size |

Separate `CachedNetworkImage` calls for avatars, story and backdrop: `home/widgets/avatar.dart:57`, `home_screen.dart:650`, `shop/shop_screens.dart:184,278`, `auth/profile_setup_screen.dart:236`, `social/story_viewer.dart:1278`, and `media_frame.dart:392` (32 px backdrop).

## 2. Does the grid decode full 1600 px images into memory?
No. `memCacheWidth` is set, so a grid tile stays at about 360 px wide in memory instead of 1600. The costs that remain:
- **Download size:** the full original is still downloaded and stored on disk. I measured live feed images of 385 KB and 587 KB (941×1672) and 502 KB (1086×1448). `NovaImageCache` limits the number of files but not total bytes.
- **Decode work:** the full JPEG still has to be decoded on the phone for every tile.
- **Slight upscaling:** `memCacheWidth` limits width only. A 16:9 image in a square tile is decoded at 360×203 and then stretched to fill 338 px of height. A thumbnail with a short side of at least 400 px avoids this.

## 3. Live checks (read-only GETs)
- **A `?w=360` query does nothing today.** The server ignores the query string (`uploadEdgeKey` builds the key from `origin + pathname`), so `/uploads/x.jpg?w=360` returns the original from the edge cache. The app would then store the original twice on disk under two different URLs.
- **A path-based thumbnail 404s, and 404s are slow and uncached.** `/uploads/t/x.webp` and `/uploads/x.w360.jpg` both return 404 JSON with `cache-control: no-store` and go back to Tashkent every time. I measured 0.4–1.1 s from IAD (my proxy's exit point); UZ users hit Warsaw, so their numbers will differ. If the app guessed thumbnail URLs before the server supports them, every grid tile would pay this delay before falling back.
- **Conclusion:** the server should advertise the thumbnail per post with a `thumbUrl` field. The app uses it when present, so there is no deploy-order dependency and no URL pattern fixed into shipped binaries. If the field is missing, behavior is exactly as today.

## 4. The app change (3 files)

**`lib/data/models/models.dart` (Post)**
```dart
    this.views = 0,
    this.thumbUrl = '',
  });
  final String thumbUrl;          // '' = server sent none
// in copyWithKind and in copyWith, after `views: ...`:
        thumbUrl: thumbUrl,
// in Post.fromJson, after `views: _i(j['viewCount'] ?? j['views']),`
      thumbUrl: _u(j['thumbUrl']),
```

**`lib/features/social/media_frame.dart`**
```dart
void _rememberDecode(String url, int width, {String? via}) {
  final prev = _decodedWidths.remove(url);
  final take = prev == null || width <= prev;
  _decodedWidths[url] = take ? width : prev;
  if (take) { if (via == null) { _decodedVia.remove(url); } else { _decodedVia[url] = via; } }
  if (_decodedWidths.length > _decodedWidthsMax) {
    final old = _decodedWidths.keys.first;
    _decodedWidths.remove(old); _decodedVia.remove(old);
  }
}
final _decodedVia = <String, String>{};   // original -> thumb whose small decode is in memory
final _thumbMisses = <String>{};           // thumbs that failed this session (404 is no-store)
const _thumbMissesMax = 400;

Widget _placeholder(BuildContext context, String original, int target, {...}) {
  final t = context.tokens;
  final prev = _decodedWidths[original];
  if (prev == null || prev >= target) return ColoredBox(color: t.surface2);
  final url = _decodedVia[original] ?? original;   // grid -> post detail reuses the tile bitmap
  return Image(image: ResizeImage(
      CachedNetworkImageProvider(url, cacheManager: NovaImageCache.manager), width: prev), ...);
}

Widget mediaImage(..., bool screenWidth = false, String thumb = '') {
  ...
  Widget net(int width, {bool original = false}) {
    final small = !original && thumb.isNotEmpty && !_thumbMisses.contains(thumb);
    final ph = _placeholder(context, url, width, fit: fit, alignment: alignment);
    _rememberDecode(url, width, via: small ? thumb : null);
    return CachedNetworkImage(
      cacheManager: NovaImageCache.manager,
      fadeOutDuration: NovaImageCache.fadeOut,
      fadeInDuration: NovaImageCache.fadeIn,
      imageUrl: small ? thumb : url,
      fit: fit, alignment: alignment,
      memCacheWidth: width,
      placeholder: (_, __) => ph,
      errorWidget: (_, __, ___) {
        if (!small) return broken();
        _thumbMisses.add(thumb);
        if (_thumbMisses.length > _thumbMissesMax) _thumbMisses.remove(_thumbMisses.first);
        return net(width, original: true);    // grey placeholder, then the original; never a broken tile
      },
    );
  }
  // unchanged: `if (screenWidth) return net(decodeWidth(context));` and `return net(decodeWidth(context, side));`
```

**`lib/features/profile/profile_screen.dart:1777-1778`**, the only call site that changes:
```dart
mediaImage(context, p.mediaUrls.first, fit: BoxFit.cover, thumb: p.thumbUrl),
```

What stays full-size: post detail and feed (`AdaptiveMedia`, `_resolveImage`), the fullscreen viewer and Reels never pass `thumb`. Bundled asset images ignore it.

Effect on opening a post from the grid: the post page's placeholder shows the thumbnail already in memory, so there is no grey flash. This is the same key the tile's `CachedNetworkImage` used, as `CachedNetworkImageProvider.==` compares the URL.

## 5. Tests
**Tests that need updating: none.** These tests check exact strings in the source, and the patch keeps all of those strings:
- `test/performance_guard_test.dart:42-48,95` (`if (screenWidth) return net(decodeWidth(context));`, `return net(decodeWidth(context, side));`, `memCacheWidth: width,`, `decodeWidth(context, side)`) and the `NovaImageCache` / fade checks at lines 103-131.
- `test/image_open_placeholder_test.dart:82-85` (`image: ResizeImage(`, `CachedNetworkImageProvider(url, cacheManager: NovaImageCache.manager)`) and its `smallestDecodeWidth` checks, which are still keyed by the original URL with the same smallest-width rule.

These tests assert exact `/uploads/` URLs and are unaffected, because `mediaUrls` and `mediaUrl()` do not change:
- `media_url_test.dart` 20-131
- `real_json_contract_test.dart:81`
- `profile_music_test.dart` 62, 68, 117
- `contact_links_test.dart:285`
- `post_music_test.dart:48`
- `music_test.dart:162-164`
- `music_source_test.dart` 38, 47
- `catalog_item_contract_test.dart:78`

`profile_grid_lazy_test.dart` uses a bundled asset tile, which ignores `thumb`.

**New test:** `test/grid_thumb_fallback_test.dart`. It checks that the tile asks for the thumbnail first and, when that fails (400 in the test environment), loads the original. On rebuild it goes straight to the original. A tile with no thumbnail behaves as before. `thumbUrl` is parsed into an absolute URL and survives `copyWith` and `copyWithKind`. It needs a mocked `plugins.flutter.io/path_provider` channel and `runAsync`.

## 6. What the server needs to provide
- Add `thumbUrl` (relative `/uploads/...`) to image posts in `/api/records/:code/posts` and `/api/companies/:id/posts`.
- Send it only when the thumbnail actually exists, or behind a flag.
- Suggested size: short side about 400 px (covers 133pt tiles at 3x), q≈75, which comes to roughly 20-40 KB.
- The file extension must be jpg/png/webp so the existing edge cache (`uploadEdgeKey`) picks it up.

Not covered by this change, optional follow-ups:
- The same `thumb:` parameter could go on the catalog grid (`catalog_view.dart:638`), the storefront grid (`store_catalog.dart:456`) and the Discover product thumbs (`discover_cards.dart:816`).
- A server `thumbUrl` for video posts would let `profile_screen.dart:1747` show an image instead of opening the mp4 to grab a poster frame.

Files are in /tmp/claude-0/-home-user-nfcx/5546dd0b-6c34-5e19-b153-171390652b64/scratchpad:
- thumbcheck/mobile_nova/ (patched scratch copy)
- thumbcheck/mobile_nova/test/grid_thumb_fallback_test.dart
- thumb_media_frame.diff
- thumb_models.diff
- thumb_profile.diff
- thumbcheck_full.log