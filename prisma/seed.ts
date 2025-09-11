import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Seed Alice
  const alice = await prisma.user.upsert({
    where: { id: "seed_alice" },
    update: { mockBalance: 500000 },
    create: {
      id: "seed_alice",
      displayName: "Alice",
      mockBalance: 500000,
    },
  });
  console.log("✅ Seeded Alice:", alice.id, "balance =", alice.mockBalance);

  // Seed Bob
  const bob = await prisma.user.upsert({
    where: { id: "seed_bob" },
    update: { mockBalance: 500000 },
    create: {
      id: "seed_bob",
      displayName: "Bob",
      mockBalance: 500000,
    },
  });
  console.log("✅ Seeded Bob:", bob.id, "balance =", bob.mockBalance);

  console.log("🌱 Seeding complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
