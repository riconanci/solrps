// app/layout.tsx
import "./globals.css";
import { ReactNode } from "react";
import { Navigation } from "@/components/Navigation";

export const metadata = {
  title: 'SolRPS - Rock Paper Scissors on Solana',
  description: 'Play-to-earn Rock Paper Scissors on Solana blockchain',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-white">
        <div className="flex flex-col min-h-screen">
          <Navigation />
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}