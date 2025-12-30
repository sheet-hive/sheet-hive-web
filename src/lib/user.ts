import type { User } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function upsertUser(user: User) {
  if (!user?.uid) return;
  const ref = doc(db, "users", user.uid);
  const payload = {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    lastSeen: serverTimestamp(),
  };
  try {
    await setDoc(ref, payload, { merge: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to upsert user:", err);
  }
}
