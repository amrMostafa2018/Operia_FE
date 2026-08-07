import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

import { User, UserCapabilities } from '@core/models/user.model';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isLoading: false,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(store => ({
    isAuthenticated: computed(() => !!store.accessToken() && !!store.user()),
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
    setCapabilities(capabilities: UserCapabilities): void {
      const user = store.user();
      if (user) {
        patchState(store, {
          user: {
            ...user,
            permissions: capabilities.permissions,
          },
        });
      }
    },
    setLoading(isLoading: boolean): void {
      patchState(store, { isLoading });
    },
    clearAuth(): void {
      patchState(store, initialState);
    },
  }))
);
