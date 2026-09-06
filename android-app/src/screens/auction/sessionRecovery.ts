import { useAuthStore } from '../../state/authStore';

/**
 * What every "Sessiya tugadi → Kirish" button in the auction section does.
 *
 * `GET /api/auth/me` is re-run: if the cookie is actually still good the tab
 * simply refetches, and if it is gone the store flips to `guest`, which makes
 * RootNavigator swap the whole app to the Auth stack. Either way the button
 * does something real — no dead CTA, and no auction screen tries to render a
 * login form of its own.
 */
export function recoverSession(): void {
  void useAuthStore
    .getState()
    .refresh()
    .catch(() => {
      void useAuthStore.getState().logout();
    });
}
