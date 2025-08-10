import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: number;
  username: string;
  email: string;
  isVerified: boolean;
  isActive?: boolean;
}


interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  checkAuth: () => boolean;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      setUser: (user) =>
        set(() => ({
          user,
          isAuthenticated: !!user,
        })),

      setToken: (token) =>
        set(() => ({
          token,
          isAuthenticated: !!token,
        })),

      setLoading: (loading) =>
        set(() => ({
          isLoading: loading,
        })),

      setError: (error) =>
        set(() => ({
          error,
        })),

      login: (user, token) =>
        set(() => ({
          user,
          token,
          isAuthenticated: true,
          error: null,
        })),

      logout: () =>
        set(() => ({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        })),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      checkAuth: () => {
        const state = get();
        return state.isAuthenticated && !!state.token;
      },

      clearError: () =>
        set(() => ({
          error: null,
        })),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist token and user info, not loading/error states
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selector hooks
export const useAuth = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    updateUser,
    checkAuth,
    clearError,
  } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    updateUser,
    checkAuth,
    clearError,
  };
};

export const useCurrentUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthToken = () => useAuthStore((state) => state.token);