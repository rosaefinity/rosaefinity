// =============================================
// RosaeFinity Server — Database Seed
// Creates default plans and initial system data.
// =============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
