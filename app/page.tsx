import Link from "next/link";

export default function Landing() {
  return (
    <main className="grid place-items-center py-24 text-center">
      <div className="space-y-6">
        <h1 className="text-4xl font-bold">SolRPS</h1>
        <p className="text-neutral-300">
          Rock–Paper–Scissors on Solana — V1 with mock escrow & commit–reveal.
        </p>
        <Link
          href="/play"
          className="inline-block rounded-xl bg-white/10 px-6 py-3 hover:bg-white/20"
        >
          Initiate
        </Link>
      </div>
    </main>
  );
}
