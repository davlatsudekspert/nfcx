/**
 * Display labels for the record enums the Worker actually accepts.
 * `profileType` is whitelisted server-side to exactly these three values
 * (hosting/worker.js `validateRecordBody`) — the picker in the ID owner
 * workspace must not offer a fourth.
 */
export type ProfileType = 'personal' | 'expert' | 'business';

export const PROFILE_TYPES: ProfileType[] = ['personal', 'expert', 'business'];

export const PROFILE_TYPE_LABEL: Record<ProfileType, string> = {
  personal: 'Shaxsiy',
  expert: 'Ekspert',
  business: 'Biznes',
};

/** Never returns `undefined`/`[object Object]` for an unexpected value. */
export function profileTypeLabel(value: unknown): string {
  return typeof value === 'string' && value in PROFILE_TYPE_LABEL
    ? PROFILE_TYPE_LABEL[value as ProfileType]
    : PROFILE_TYPE_LABEL.personal;
}

export function isProfileType(value: unknown): value is ProfileType {
  return typeof value === 'string' && (PROFILE_TYPES as string[]).includes(value);
}
