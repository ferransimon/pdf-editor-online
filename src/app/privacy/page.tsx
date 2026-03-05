"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";

export default function PrivacyPage() {
  const { t } = useI18n();
  const p = t.privacy;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 px-4 py-12">
      <article className="max-w-2xl mx-auto bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-8 space-y-8">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {p.title}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {p.lastUpdated}
          </p>
        </header>

        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {p.intro}
        </p>

        {/* Section 1 */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            {p.section1Title}
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {p.section1Body}
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            {p.section2Title}
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {p.section2Body}
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-700 dark:text-zinc-300 pl-2">
            {p.section2List.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {p.section2Footer}{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              vercel.com/legal/privacy-policy
            </a>
            .
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            {p.section3Title}
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {p.section3Body}
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            {p.section4Title}
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {p.section4Body}
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            {p.section5Title}
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {p.section5Body}
          </p>
          <a
            href="https://github.com/ferransimon/pdf-editor-online"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {p.repoLabel}
          </a>
        </section>

        {/* Section 6 */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            {p.section6Title}
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {p.section6Body}
          </p>
        </section>

        {/* Back link */}
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Link
            href="/"
            className="text-sm text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity"
          >
            {p.backHome}
          </Link>
        </div>
      </article>
    </main>
  );
}
