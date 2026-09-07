import { setAudioModeAsync } from 'expo-audio';

/**
 * One-time audio session setup for profile music (expo-audio, NOT expo-av).
 *
 * Without this the player is created against the OS default session, which
 * on some Android builds ducks under (or is silenced by) the ringer/"silent"
 * state — one of the reasons the old widget sat at 0:00 without a sound.
 * Profile music is foreground-only by design (a visitor's phone must not
 * keep singing after they leave the profile), so background playback stays
 * off and the screen pauses explicitly on blur.
 */
let applied: Promise<void> | null = null;

export function ensureAudioMode(): Promise<void> {
  if (!applied) {
    applied = setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {
      // A failure here must never block playback — retry on the next call.
      applied = null;
    });
  }
  return applied;
}
