// prisma/seed.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create or update seed users
  const alice = await prisma.user.upsert({
    where: { id: "seed_alice" },
    update: {}, // Don't update if exists
    create: { 
      id: "seed_alice", 
      displayName: "Alice", 
      mockBalance: 500000 
    },
  });

  const bob = await prisma.user.upsert({
    where: { id: "seed_bob" },
    update: {}, // Don't update if exists  
    create: { 
      id: "seed_bob", 
      displayName: "Bob", 
      mockBalance: 500000 
    },
  });

  console.log("✅ Created users:", { alice: alice.displayName, bob: bob.displayName });

  // Create a sample open session by Alice
  const existingSession = await prisma.session.findFirst({
    where: { 
      creatorId: alice.id,
      status: "OPEN" 
    }
  });

  if (!existingSession) {
    const sampleSession = await prisma.session.create({
      data: {
        status: "OPEN",
        rounds: 3,
        stakePerRound: 100,
        totalStake: 300,
        commitHash: "DEMO_COMMIT_HASH_12345", // Demo hash
        saltHint: "8",
        creatorId: alice.id,
        revealDeadline: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes from now
        isPrivate: false,
      },
    });

    console.log("✅ Created sample session:", sampleSession.id);
  } else {
    console.log("✅ Sample session already exists");
  }

  console.log("🎉 Database seeded successfully!");
  console.log("🎮 Alice balance:", alice.mockBalance);
  console.log("🎮 Bob balance:", bob.mockBalance);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });