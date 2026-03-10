/**
 * Authentication context providing user state and auth actions.
 *
 * On mount, the provider attempts to refresh the session using the httpOnly
 * refresh-token cookie (sent automatically by the browser). This lets sessions
 * survive page reloads without requiring re-login.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { api, type AuthUser } from "../api";
import { setTokens, clearTokens, onSessionExpired } from "../auth-storage";

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Attempt to restore session on mount via httpOnly cookie
  useEffect(() => {
    api
      .refreshTokens()
      .then(({ data }) => {
        setTokens(data.accessToken);
        return api.getMe(data.accessToken);
      })
      .then(({ data: me }) => {
        setUser(me);
      })
      .catch(() => {
        // Refresh token invalid/expired — require re-login
        clearTokens();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Listen for session-expired events fired from fetchJson
  // when a background 401-refresh cycle fails.
  useEffect(() => {
    return onSessionExpired(() => {
      setUser(null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.login(email, password);
    setTokens(data.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, name: string, password: string) => {
    const { data } = await api.register(email, name, password);
    setTokens(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    // Fire-and-forget server-side logout (revokes refresh tokens)
    api.logout().catch(() => {
      // Best-effort — even if the server call fails, clear local tokens
    });
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
