import { parseMusicSource, isEmbedMusic } from '../lib/music';

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
    expect(result).toEqual({ kind: 'yandex', frag: 'track/456/123' });
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
