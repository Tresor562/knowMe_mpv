import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useColorScheme } from 'react-native';
import {
  AppearanceResponse,
  AppearanceUpdateInput,
  fetchAppearance,
  loadCachedAppearance,
  MobileThemePalette,
  resolveMobilePalette,
  updateAppearance
} from './appearance';

type AppearanceContextValue = {
  appearance: AppearanceResponse | null;
  colors: MobileThemePalette;
  loading: boolean;
  busy: boolean;
  refresh: () => Promise<AppearanceResponse | null>;
  update: (input: AppearanceUpdateInput) => Promise<AppearanceResponse>;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [appearance, setAppearance] = useState<AppearanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const colors = useMemo(
    () => resolveMobilePalette(appearance, systemColorScheme),
    [appearance, systemColorScheme]
  );

  const refresh = useCallback(async () => {
    try {
      const response = await fetchAppearance();
      setAppearance(response);
      return response;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const cached = await loadCachedAppearance();
      if (active && cached) setAppearance(cached);
      const server = await refresh();
      if (active && server) setAppearance(server);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const update = useCallback(
    async (input: AppearanceUpdateInput) => {
      setBusy(true);
      try {
        const response = await updateAppearance(
          input,
          appearance?.preference.version ?? 0
        );
        setAppearance(response);
        return response;
      } finally {
        setBusy(false);
      }
    },
    [appearance?.preference.version]
  );

  const value = useMemo(
    () => ({ appearance, colors, loading, busy, refresh, update }),
    [appearance, colors, loading, busy, refresh, update]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance doit être utilisé dans AppearanceProvider.');
  }
  return context;
}
