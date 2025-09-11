// app/api/_utils.ts
import { prisma } from "@/lib/db";

export async function getUserOrSeed() {
  // Mock auth - replace with real auth later
  const user = await prisma.user.findUnique({ 
    where: { id: "seed_alice" } 
  });
  
  if (!user) {
    throw new Error("Seed user missing. Run: npm run db:seed");
  }
  
  return user;
}