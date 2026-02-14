import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-3xl py-16 sm:py-24 md:py-32 px-4 sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-zinc-50 mb-4">SheetHive</h1>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/projects" className="inline-block rounded border border-black px-6 py-3 text-black bg-white hover:opacity-90 dark:bg-neutral-800 dark:text-white">プロジェクト一覧へ</Link>
        </div>
      </main>
    </div>
  );
}
