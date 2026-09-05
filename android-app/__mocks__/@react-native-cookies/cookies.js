// Jest manual mock — the real native module throws at import time outside
// a linked native runtime (it checks for its native counterpart eagerly).
// Tests only need api/client.ts's `API_ORIGIN` re-export from
// src/native/cookies.ts; the actual cookie read/write is exercised on a
// real device, not under Jest.
module.exports = {
  get: jest.fn().mockResolvedValue({}),
  clearByName: jest.fn().mockResolvedValue(true),
  clearAll: jest.fn().mockResolvedValue(true),
};
