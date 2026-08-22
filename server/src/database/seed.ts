// =============================================
// RosaeFinity Server — Database Seed
// Creates default plans, demo user, and initial system data.
// =============================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

const DEMO_USER = {
  email: 'admin@rosaefinity.app',
  password: 'demo123',
  displayName: 'Admin',
  accountType: 'enterprise' as const,
  role: 'ADMIN' as const,
};

const DEFAULT_PLANS = [
  {
    id: 'guest',
    name: 'Guest',
    description: 'Limited guest access',
    features: ['basic-alerts'],
    maxActions: 0,
    maxSounds: 0,
    maxOverlays: 0,
    maxProfiles: 0,
    maxScreens: 1,
    maxPointsUsers: 0,
    maxDevices: 1,
    isTrialAvailable: false,
    trialDurationDays: 0,
    sortOrder: 0,
    isActive: true,
  },
  {
    id: 'free',
    name: 'Free',
    description: 'Free tier with basic features',
    features: ['basic-alerts', 'basic-overlays', 'basic-actions'],
    maxActions: 5,
    maxSounds: 3,
    maxOverlays: 2,
    maxProfiles: 1,
    maxScreens: 1,
    maxPointsUsers: 0,
    maxDevices: 1,
    isTrialAvailable: true,
    trialDurationDays: 7,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Professional tier with advanced features',
    features: ['basic-alerts', 'basic-overlays', 'basic-actions', 'advanced-overlays', 'unlimited-actions', 'coin-jar', 'gift-alerts', 'multi-screen'],
    maxActions: 50,
    maxSounds: 20,
    maxOverlays: 10,
    maxProfiles: 5,
    maxScreens: 3,
    maxPointsUsers: 10,
    maxDevices: 3,
    isTrialAvailable: true,
    trialDurationDays: 14,
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Enterprise tier with all features',
    features: ['basic-alerts', 'basic-overlays', 'basic-actions', 'advanced-overlays', 'unlimited-actions', 'coin-jar', 'gift-alerts', 'multi-screen', 'api-access', 'priority-support', 'custom-branding'],
    maxActions: -1,
    maxSounds: -1,
    maxOverlays: -1,
    maxProfiles: -1,
    maxScreens: -1,
    maxPointsUsers: -1,
    maxDevices: -1,
    isTrialAvailable: true,
    trialDurationDays: 30,
    sortOrder: 3,
    isActive: true,
  },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Upsert plans
  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
    console.log(`  ✓ Plan: ${plan.name} (${plan.id})`);
  }

  // Upsert demo user
  const passwordHash = await bcrypt.hash(DEMO_USER.password, BCRYPT_ROUNDS);
  const existingUser = await prisma.user.findUnique({ where: { email: DEMO_USER.email } });
  if (!existingUser) {
    await prisma.user.create({
      data: {
        email: DEMO_USER.email,
        passwordHash,
        displayName: DEMO_USER.displayName,
        authProvider: 'email',
        accountType: DEMO_USER.accountType,
        role: DEMO_USER.role,
        emailVerified: true,
      },
    });
    console.log(`  ✓ Demo user: ${DEMO_USER.email} (enterprise, ADMIN)`);
  } else {
    // Update password hash if user already exists
    await prisma.user.update({
      where: { email: DEMO_USER.email },
      data: { passwordHash, accountType: DEMO_USER.accountType, role: DEMO_USER.role },
    });
    console.log(`  ✓ Demo user updated: ${DEMO_USER.email}`);
  }

  console.log('✅ Database seeded successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
