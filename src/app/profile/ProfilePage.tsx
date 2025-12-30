"use client";
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { UserProfile } from "@/models/user";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const ref = doc(db, "users", u.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(err);
        }
      }
    });
    return () => unsub();
  }, []);

  const logout = async () => {
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
          Sign out
        </button>
      </div>
    </main>
  );
}
