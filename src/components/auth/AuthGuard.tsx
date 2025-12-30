"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // 未ログインなら /login へ遷移
        router.replace("/login");
      }
      setChecked(true);
    });
    return () => unsub();
  }, [router]);

  // 認証確認中は何も描画しない（またはローディング表示）
  if (!checked) return null;

  return <>{children}</>;
}
