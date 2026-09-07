import { parseMusicSource, isEmbedMusic, resolveAudioUrl, youtubeListId } from '../lib/music';

describe('music.ts (ported from src/lib/music.js) — all three source kinds', () => {
  it('parses a youtube.com watch URL', () => {
    expect(parseMusicSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      kind: 'youtube',
      id: 'dQw4w9WgXcQ',
    });
  });

  it('parses a youtu.be short URL', () => {
    expect(parseMusicSource('https://youtu.be/dQw4w9WgXcQ')).toEqual({ kind: 'youtube', id: 'dQw4w9WgXcQ' });
  });

  it('parses a Yandex Music track URL', () => {
    const result = parseMusicSource('https://music.yandex.ru/album/123/track/456');
    expect(result).toEqual({ kind: 'yandex', frag: 'track/456/123', collection: false });
  });

  it('falls back to a direct audio file URL', () => {
    expect(parseMusicSource('https://nfcstore.uz/uploads/song.mp3')).toEqual({
      kind: 'audio',
      url: 'https://nfcstore.uz/uploads/song.mp3',
    });
  });

  it('returns null for an empty source', () => {
    expect(parseMusicSource('')).toBeNull();
    expect(parseMusicSource(undefined)).toBeNull();
  });

  it('isEmbedMusic is true only for youtube/yandex, not direct audio', () => {
    expect(isEmbedMusic('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isEmbedMusic('https://music.yandex.ru/album/1/track/2')).toBe(true);
    expect(isEmbedMusic('https://nfcstore.uz/uploads/song.mp3')).toBe(false);
  });
});

describe('music.ts — native hardening (release build, playlists)', () => {
  it('resolves the /uploads/ path that POST /api/upload-audio returns to an absolute https URL', () => {
    expect(parseMusicSource('/uploads/a1b2c3.mp3')).toEqual({ kind: 'audio', url: 'https://nfcstore.uz/uploads/a1b2c3.mp3' });
  });

  it('upgrades http:// to https:// (usesCleartextTraffic is false in the release build)', () => {
    expect(resolveAudioUrl('http://cdn.example.com/song.mp3')).toBe('https://cdn.example.com/song.mp3');
    expect(parseMusicSource('http://nfcstore.uz/uploads/x.m4a')).toEqual({ kind: 'audio', url: 'https://nfcstore.uz/uploads/x.m4a' });
  });

  it('returns null (no player) for a value the native player cannot load', () => {
    expect(parseMusicSource('just some words')).toBeNull();
    expect(parseMusicSource('javascript:alert(1)')).toBeNull();
    expect(parseMusicSource('   ')).toBeNull();
    expect(parseMusicSource(null)).toBeNull();
  });

  it('keeps a YouTube list= playlist id so the player can auto-advance', () => {
    expect(parseMusicSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb')).toEqual({
      kind: 'youtube',
      id: 'dQw4w9WgXcQ',
      listId: 'PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb',
    });
    expect(parseMusicSource('https://youtube.com/playlist?list=PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb')).toEqual({
      kind: 'youtube',
      id: '',
      listId: 'PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb',
    });
    expect(parseMusicSource('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=OLAK5uy_abcdefghijk')).toEqual({
      kind: 'youtube',
      id: 'dQw4w9WgXcQ',
      listId: 'OLAK5uy_abcdefghijk',
    });
  });

  it('ignores auto-generated Mix radios (RD…), which embeds cannot load', () => {
    expect(parseMusicSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ')).toEqual({ kind: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(youtubeListId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('flags Yandex albums/playlists as self-advancing collections, tracks as single', () => {
    expect(parseMusicSource('https://music.yandex.ru/album/123/track/456')).toEqual({ kind: 'yandex', frag: 'track/456/123', collection: false });
    expect(parseMusicSource('https://music.yandex.uz/album/123')).toEqual({ kind: 'yandex', frag: 'album/123', collection: true });
    expect(parseMusicSource('https://music.yandex.com/users/someone/playlists/1000')).toEqual({ kind: 'yandex', frag: 'playlist/someone/1000', collection: true });
  });
});
