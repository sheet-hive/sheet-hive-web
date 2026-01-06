"use client";
import React, { JSX, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type Auth,
} from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { upsertUser } from "../../lib/user";
import { isDemoMode } from "@/lib/appMode";

type SessionUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
};

export default function GoogleLoginButton(): JSX.Element {
  const [user, setUser] = useState<SessionUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (isDemoMode()) {
      setUser({
        uid: "demo-user",
        displayName: "Demo User",
        email: "demo@example.com",
      });
      return;
    }

    const authOrNull = auth as unknown as Auth | null;
    if (!authOrNull) {
      setUser(null);
      return;
    }

    const unsub = onAuthStateChanged(authOrNull, async (u) => {
      setUser(
        u
          ? {
              uid: u.uid,
              displayName: u.displayName ?? null,
              email: u.email ?? null,
            }
          : null
      );
      if (u) {
        // Firestore にユーザー情報を保存/更新
        await upsertUser(u);
      }
    });
    return () => unsub();
  }, []);

  const signIn = async () => {
    if (isDemoMode()) {
      router.replace("/projects");
      return;
    }

    const authOrNull = auth as unknown as Auth | null;
    if (!authOrNull) {
      alert(
        "Firebase の設定が見つかりません。環境変数（NEXT_PUBLIC_FIREBASE_*）を設定してください。"
      );
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      // スプレッドシート読み取りスコープを付与
      provider.addScope("https://www.googleapis.com/auth/spreadsheets.readonly");
      provider.addScope("https://www.googleapis.com/auth/drive.metadata.readonly");
      
      const result = await signInWithPopup(authOrNull, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken ?? null;
      
      // アクセストークンをFirestoreに保存
      if (accessToken && result.user) {
        if (!db) {
          throw new Error("Firestore is not initialized");
        }
        const tokenRef = doc(db, "users", result.user.uid, "tokens", "google");
        // Googleのアクセストークンは通常1時間で期限切れ
        const expiresAt = new Date(Date.now() + 3600 * 1000);
        await setDoc(tokenRef, {
          accessToken,
          expiresAt,
          updatedAt: serverTimestamp(),
          scopes: [
            "https://www.googleapis.com/auth/spreadsheets.readonly",
            "https://www.googleapis.com/auth/drive.metadata.readonly"
          ]
        });
      }
      
      // サインイン成功後はトップページへリダイレクト
      router.replace("/");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Google sign-in error:", err);
      alert("サインインに失敗しました。コンソールを確認してください。");
    }
  };

  const logout = async () => {
    if (isDemoMode()) {
      router.replace("/projects");
      return;
    }

    const authOrNull = auth as unknown as Auth | null;
    if (!authOrNull) {
      return;
    }
    try {
      await signOut(authOrNull);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Sign-out error:", err);
      alert("サインアウトに失敗しました。コンソールを確認してください。");
    }
  };

  return (
    <div className="p-4">
      {user ? (
        <div className="flex items-center gap-4">
          <div>
            <div className="font-medium">{user.displayName ?? user.email}</div>
            <div className="text-sm text-gray-500">{user.email ?? ""}</div>
          </div>
          {!isDemoMode() && (
            <button
              onClick={logout}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Sign out
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={signIn}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Sign in with Google
        </button>
      )}
    </div>
  );
}
