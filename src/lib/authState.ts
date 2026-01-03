"use client";

import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

import { isDemoMode } from "@/lib/appMode";
import { auth } from "@/lib/firebase";

export type AppUser = Pick<User, "uid" | "displayName" | "email" | "getIdToken">;

export const DEMO_USER: AppUser = {
  uid: "demo-user",
  displayName: "Demo User",
  email: "demo@example.com",
  getIdToken: async () => "demo-token",
};

export function subscribeAuthUser(onChange: (user: AppUser | null) => void): () => void {
  if (isDemoMode()) {
    onChange(DEMO_USER);
    return () => {};
  }

  return onAuthStateChanged(auth, (u) => onChange(u));
}
