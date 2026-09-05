import React from 'react';
import { StubScreen } from '../shared/StubScreen';

/** Real session-bootstrap logic (GET /api/auth/me) lands in Phase 5. */
export function SplashScreen() {
  return <StubScreen screenName="Splash" phase="Phase 5 — Auth" />;
}
