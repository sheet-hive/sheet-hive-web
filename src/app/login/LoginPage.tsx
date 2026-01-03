"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import GoogleLoginButton from "../../components/auth/GoogleLoginButton";
import { isDemoMode } from "@/lib/appMode";

export const metadata = {
  title: "Login | SheetHive",
};

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (isDemoMode()) {
      router.replace("/projects");
    }
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-black px-4">
      <div className="max-w-md w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow p-6 rounded">
        <h1 className="text-2xl font-semibold mb-4 text-black dark:text-white">SheetHive — Login</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Google アカウントでログインしてシート接続を始めてください。
        </p>
        <GoogleLoginButton />
      </div>
    </main>
  );
}
