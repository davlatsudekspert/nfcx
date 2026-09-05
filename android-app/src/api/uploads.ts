import { api } from './client';

export interface UploadResult {
  url: string; // "/uploads/<file>" — relative to API_ORIGIN, safe to pass straight into <Image source={{uri}}>
}

/**
 * Image upload — base64 dataUrl JSON body, ≤700KB (≤3MB for gif). The
 * caller (Profile Edit, Company logo/cover pickers) MUST downscale +
 * JPEG-encode client-side first (android/docs/02-API_MAP.md §2.8) — a
 * modern phone-camera photo will otherwise silently 413.
 */
export function uploadImage(dataUrl: string): Promise<UploadResult> {
  return api.post<UploadResult>('/api/upload', { dataUrl });
}

/** Audio upload — same dataUrl contract, ≤10MB, for the profile music feature. */
export function uploadAudio(dataUrl: string): Promise<UploadResult> {
  return api.post<UploadResult>('/api/upload-audio', { dataUrl });
}

/** Card video upload — raw bytes, NOT JSON (android/docs/02-API_MAP.md §2.8). */
export function uploadCardVideo(bytes: ArrayBuffer, contentType: 'video/mp4' | 'video/webm'): Promise<UploadResult> {
  return api.postRaw<UploadResult>('/api/upload-card-video', bytes, contentType);
}
