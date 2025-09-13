// app/layout.tsx
import "./globals.css";
import { Navigation } from "../src/components/Navigation";
import { ReactNode } from "react";

export const metadata = {
  title: 'SolRPS - Rock Paper Scissors P2E',
  description: 'Play-to-earn Rock Paper Scissors on Solana',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-white">
        <Navigation />
        <main>{children}</main>
      </body>
    </html>
  );
}