"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { subscribeAuthUser } from "@/lib/authState";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const unsub = subscribeAuthUser((user) => {
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
