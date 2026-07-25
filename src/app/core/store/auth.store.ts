import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

import { User } from '@core/models/user.model';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isLoading: false,
  error: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(store => ({
    isAuthenticated: computed(() => !!store.accessToken() && !!store.user()),
    userRole: computed(() => store.user()?.role ?? null),
    currentUser: computed(() => store.user()),
    permissions: computed(() => store.user()?.permissions ?? []),
  })),
  withMethods(store => ({
    setAccessToken(accessToken: string): void {
      patchState(store, { accessToken });
    },
    setUser(user: User): void {
      patchState(store, { user });
    },
    setLoading(isLoading: boolean): void {
      patchState(store, { isLoading });
    },
    setError(error: string | null): void {
      patchState(store, { error });
    },
    clearAuth(): void {
      patchState(store, initialState);
    },
  }))
);
