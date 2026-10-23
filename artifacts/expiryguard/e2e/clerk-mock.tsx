import type { ReactNode } from 'react';

export function UserButton() {
  return <span aria-label="Signed in as browser test owner" />;
}

export function useAuth() {
  return { userId: 'browser-test-owner', sessionId: 'business-profile-session' };
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  return children;
}
