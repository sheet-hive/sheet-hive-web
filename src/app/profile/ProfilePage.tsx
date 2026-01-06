"use client";
import React, { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { UserProfile } from "@/models/user";
import { isDemoMode } from "@/lib/appMode";
import { subscribeAuthUser, type AppUser } from "@/lib/authState";
import { demoApi } from "@/demo/demoApi";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsub = subscribeAuthUser((u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isDemoMode()) {
      void (async () => {
        const p = await demoApi.getCurrentUserProfile();
        setProfile({
          uid: p.uid,
          displayName: p.displayName ?? null,
          email: p.email ?? null,
        } as UserProfile);
      })();
      return;
    }

    void (async () => {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    })();
  }, [user]);

  const logout = async () => {
    if (isDemoMode()) {
      router.replace("/projects");
      return;
    }
    await signOut(auth);
  };

  if (!user) return <div className="p-8">Loading...</div>;

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">Profile</h1>
      <div className="mb-4">
        <div className="text-sm text-gray-600">Name</div>
        <div className="font-medium">{profile?.displayName ?? user.displayName}</div>
      </div>
      <div className="mb-4">
        <div className="text-sm text-gray-600">Email</div>
        <div className="font-medium">{profile?.email ?? user.email}</div>
      </div>
      <div className="mb-4">
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          {isDemoMode() ? "戻る" : "Sign out"}
        </button>
      </div>
    </main>
  );
}
