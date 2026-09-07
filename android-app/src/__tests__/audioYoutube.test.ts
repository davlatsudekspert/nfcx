import { buildYoutubePlayerHtml, parseYoutubeBridgeMessage, youtubeCommandScript, youtubeSeekScript } from '../native/audioYoutube';

describe('native/audioYoutube — IFrame API bridge page', () => {
  it('embeds a single video with loop + playlist=<id> (the documented single-video loop)', () => {
    const html = buildYoutubePlayerHtml({ videoId: 'dQw4w9WgXcQ' });
    expect(html).toContain('videoId: "dQw4w9WgXcQ"');
    expect(html).toContain('playlist: "dQw4w9WgXcQ"');
    expect(html).toContain('loop: 1');
    expect(html).not.toContain("listType: 'playlist'");
    expect(html).toContain('https://www.youtube.com/iframe_api');
  });

  it('embeds a playlist with list/listType so YouTube advances by itself', () => {
    const html = buildYoutubePlayerHtml({ videoId: 'dQw4w9WgXcQ', listId: 'PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb' });
    expect(html).toContain("listType: 'playlist'");
    expect(html).toContain('list: "PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb"');
    expect(html).not.toContain('videoId:');
  });

  it('never interpolates an unvalidated id into the page', () => {
    const html = buildYoutubePlayerHtml({ videoId: '"; alert(1); //', listId: '<script>' });
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('<script>"');
  });

  it('builds command/seek scripts that end in a boolean and clamp bad seeks', () => {
    expect(youtubeCommandScript('play')).toBe('window.__nfcCmd("play");true;');
    expect(youtubeSeekScript(12.9)).toBe('window.__nfcSeek(12);true;');
    expect(youtubeSeekScript(Number.NaN)).toBe('window.__nfcSeek(0);true;');
    expect(youtubeSeekScript(-5)).toBe('window.__nfcSeek(0);true;');
  });

  it('parses bridge messages defensively — never NaN into the UI', () => {
    expect(parseYoutubeBridgeMessage(JSON.stringify({ type: 'ready' }))).toEqual({ type: 'ready' });
    expect(parseYoutubeBridgeMessage(JSON.stringify({ type: 'state', state: 1 }))).toEqual({ type: 'state', state: 1 });
    expect(parseYoutubeBridgeMessage(JSON.stringify({ type: 'status', t: 'x', d: null, title: 5, index: 2, count: 3.7 }))).toEqual({
      type: 'status',
      t: 0,
      d: 0,
      title: '',
      author: '',
      index: 2,
      count: 3,
    });
    expect(parseYoutubeBridgeMessage('not json')).toBeNull();
    expect(parseYoutubeBridgeMessage(JSON.stringify({ type: 'other' }))).toBeNull();
    expect(parseYoutubeBridgeMessage(42)).toBeNull();
  });
});
