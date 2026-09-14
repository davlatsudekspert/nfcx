import { create } from 'zustand';

/**
 * Rol (owner / visitor) HOLAT EMAS — u hisoblanadi:
 *
 *   owner  <=>  company.ownerUserId === user.id
 *
 * Maketdagi "VIEW AS Owner/Visitor" tugmasi ishlab chiqarishga
 * o'tmadi (egasining qarori). Lekin ishlab chiqish davrida ikki
 * holatni ham ko'rish kerak, shuning uchun shu override qoladi —
 * FAQAT __DEV__ da ta'sir qiladi, relizda butunlay e'tiborsiz.
 */
export type RoleOverride = 'auto' | 'owner' | 'visitor';

type RoleState = {
  override: RoleOverride;
  setOverride: (next: RoleOverride) => void;
};

export const useRoleStore = create<RoleState>((set) => ({
  override: 'auto',
  setOverride: (next) => set({ override: next }),
}));

/**
 * Haqiqiy egalikni override bilan birlashtiradi.
 * Relizda (`__DEV__ === false`) override butunlay o'tkazib yuboriladi.
 */
export function resolveIsOwner(realOwner: boolean, override: RoleOverride): boolean {
  if (!__DEV__ || override === 'auto') return realOwner;
  return override === 'owner';
}
