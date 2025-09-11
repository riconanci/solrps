import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <div className="mx-auto max-w-6xl p-4">
          <header className="mb-6 flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold">SolRPS</Link>
            <nav className="flex gap-3 text-sm">
              <Link href="/play" className="text-neutral-300 hover:text-white">Play</Link>
              <Link href="/my" className="text-neutral-300 hover:text-white">My Matches</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
