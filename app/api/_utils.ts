import { prisma } from "@/lib/db";

export async function getUserOrSeed() {
  // In V1, always return seed user Alice for simplicity. Replace with auth later.
  const user = await prisma.user.findUnique({ where: { id: "seed_alice" } });
  if (!user) throw new Error("Seed user missing. Run db:seed.");
  return user;
}