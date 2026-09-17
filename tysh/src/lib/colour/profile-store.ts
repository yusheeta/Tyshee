"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PROFILE_COOKIE, type ColourProfile } from "./profile";

interface ProfileState {
  profile: ColourProfile | null;
  hydrated: boolean;
  setProfile: (p: ColourProfile) => void;
  clearProfile: () => void;
}

function writeCookie(season: string | null) {
  if (typeof document === "undefined") return;
  if (season) document.cookie = `${PROFILE_COOKIE}=${season}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  else document.cookie = `${PROFILE_COOKIE}=; path=/; max-age=0`;
}

export const useColourProfile = create<ProfileState>()(
  persist(
    (set) => ({
      profile: null,
      hydrated: false,
      setProfile: (profile) => {
        writeCookie(profile.season);
        set({ profile });
      },
      clearProfile: () => {
        writeCookie(null);
        set({ profile: null });
      },
    }),
    {
      name: "tysh-colour-profile",
      version: 1,
      storage: createJSONStorage(() => (typeof window === "undefined" ? (undefined as unknown as Storage) : window.localStorage)),
      partialize: (s) => ({ profile: s.profile }),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useColourProfile.setState({ hydrated: true });
      },
    },
  ),
);
