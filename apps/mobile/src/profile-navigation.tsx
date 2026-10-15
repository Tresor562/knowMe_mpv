import { createContext, useContext, type ReactNode } from 'react';

/**
 * Central routing for public KnowMe identities. The owning application decides
 * whether the target is the user's own profile and remembers the return screen.
 * Privacy and missing-account responses still come from the server.
 */
const ProfileNavigationContext = createContext<((username: string) => void) | null>(null);

export function ProfileNavigationProvider({
  onOpenProfile,
  children
}: {
  onOpenProfile: (username: string) => void;
  children: ReactNode;
}) {
  return (
    <ProfileNavigationContext.Provider value={onOpenProfile}>
      {children}
    </ProfileNavigationContext.Provider>
  );
}

export function useProfileNavigation() {
  return useContext(ProfileNavigationContext);
}
