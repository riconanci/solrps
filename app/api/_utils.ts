// app/api/_utils.ts
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function getUserOrSeed(request?: Request) {
  let userId = "seed_alice"; // Default to Alice

  // Try to get user from request URL if provided
  if (request) {
    try {
      const url = new URL(request.url);
      const userParam = url.searchParams.get('user');
      
      if (userParam === 'alice' || userParam === 'seed_alice') {
        userId = "seed_alice";
      } else if (userParam === 'bob' || userParam === 'seed_bob') {
        userId = "seed_bob";
      }
    } catch (error) {
      // If URL parsing fails, stick with default
      console.log("Could not parse URL for user detection, using Alice");
    }
  }

  // Try to get user from headers (for cases where URL isn't available)
  if (request && userId === "seed_alice") {
    try {
      const referer = request.headers.get('referer');
      if (referer) {
        const refererUrl = new URL(referer);
        const userParam = refererUrl.searchParams.get('user');
        
        if (userParam === 'bob' || userParam === 'seed_bob') {
          userId = "seed_bob";
        }
      }
    } catch (error) {
      // Fallback silently
    }
  }

  const user = await prisma.user.findUnique({ 
    where: { id: userId } 
  });
  
  if (!user) {
    throw new Error(`Seed user ${userId} missing. Run: npm run db:seed`);
  }
  
  console.log(`🎮 API using user: ${user.displayName} (${user.id})`);
  return user;
}

// Alternative version that works with headers
export async function getUserFromHeaders(request: Request) {
  // Try to detect user from various sources
  let userId = "seed_alice"; // Default

  // Check URL parameter
  const url = new URL(request.url);
  const userParam = url.searchParams.get('user');
  
  if (userParam === 'alice' || userParam === 'seed_alice') {
    userId = "seed_alice";
  } else if (userParam === 'bob' || userParam === 'seed_bob') {
    userId = "seed_bob";
  } else {
    // Check referer header
    const referer = request.headers.get('referer');
    if (referer && referer.includes('user=seed_bob')) {
      userId = "seed_bob";
    } else if (referer && referer.includes('user=bob')) {
      userId = "seed_bob";
    }
  }

  const user = await prisma.user.findUnique({ 
    where: { id: userId } 
  });
  
  if (!user) {
    throw new Error(`User ${userId} not found. Run: npm run db:seed`);
  }
  
  return user;
}