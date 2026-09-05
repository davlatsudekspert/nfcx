import { Share } from 'react-native';

export async function shareProfile(code: string, name?: string): Promise<void> {
  const url = `https://nfcstore.uz/${code}`;
  await Share.share({
    message: name ? `${name} — NFCSTORE profili\n${url}` : url,
    url, // iOS only, harmless no-op on Android
  }).catch(() => {});
}
