/**
 * Native contact save — brief §11. Full permission dance per
 * android/docs/03-ARCHITECTURE.md §3.7: an in-app rationale sheet is shown
 * the FIRST time (never on launch), only then the OS prompt; a denial shows
 * an inline empty-state with a deep link to the app's OS settings page
 * rather than a silent failure or a repeated auto-prompt.
 *
 * Targets expo-contacts@57's current `Contact.create()` class API (its
 * legacy `addContactAsync`-style API is superseded in this version).
 */
import { Contact, getPermissionsAsync, requestPermissionsAsync, type PermissionStatus } from 'expo-contacts';
import { Linking } from 'react-native';

export type ContactSaveInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  company?: string | null;
  /** The profile URL — saved into the contact's `note` field, since Android's
   * contact model has no generic "profile" field the way a vCard ORG/URL
   * line can carry one (brief §11's field list, item "note/profile URL"). */
  profileUrl?: string | null;
};

export type ContactSaveResult =
  | { status: 'saved' }
  | { status: 'permission_denied' }
  | { status: 'error'; message: string };

export async function requestContactsPermission(): Promise<boolean> {
  const { status } = await requestPermissionsAsync();
  return status === 'granted';
}

export async function getContactsPermissionStatus(): Promise<PermissionStatus> {
  const { status } = await getPermissionsAsync();
  return status;
}

export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}

export async function saveContact(input: ContactSaveInput): Promise<ContactSaveResult> {
  const granted = await requestContactsPermission();
  if (!granted) return { status: 'permission_denied' };

  try {
    await Contact.create({
      givenName: input.name,
      company: input.company || undefined,
      phones: input.phone ? [{ label: 'mobile', number: input.phone }] : undefined,
      emails: input.email ? [{ label: 'work', address: input.email }] : undefined,
      urlAddresses: input.website ? [{ label: 'website', url: input.website }] : undefined,
      note: input.profileUrl ? `NFCSTORE profil: ${input.profileUrl}` : undefined,
    });
    return { status: 'saved' };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'unknown_error' };
  }
}
