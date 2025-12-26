import { db, UserUsageTable } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Script to fix lifetime license users who have incorrect values
 * Updates maxTokenUsage, tier, maxAudioTranscriptionMinutes, and subscriptionStatus
 */
async function fixLifetimeUsers() {
  try {
    // Find all users with lifetime billing cycle
    const lifetimeUsers = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.billingCycle, 'lifetime'))
      .execute();

    console.log(`Found ${lifetimeUsers.length} lifetime user(s)`);

    for (const user of lifetimeUsers) {
      console.log(`\nUpdating user: ${user.userId}`);
      console.log(`Current values:`);
      console.log(`  - maxTokenUsage: ${user.maxTokenUsage}`);
      console.log(`  - tier: ${user.tier}`);
      console.log(`  - maxAudioTranscriptionMinutes: ${user.maxAudioTranscriptionMinutes}`);
      console.log(`  - subscriptionStatus: ${user.subscriptionStatus}`);

      // Update the user with correct lifetime license values
      await db
        .update(UserUsageTable)
        .set({
          maxTokenUsage: 5000 * 1000, // 5 million tokens
          tier: 'paid',
          maxAudioTranscriptionMinutes: 300, // 300 minutes per month
          subscriptionStatus: 'active', // Ensure it's active
        })
        .where(eq(UserUsageTable.userId, user.userId));

      console.log(`Updated to:`);
      console.log(`  - maxTokenUsage: 5000000`);
      console.log(`  - tier: paid`);
      console.log(`  - maxAudioTranscriptionMinutes: 300`);
      console.log(`  - subscriptionStatus: active`);
    }

    console.log(`\n✅ Successfully updated ${lifetimeUsers.length} lifetime user(s)`);
  } catch (error) {
    console.error('❌ Error updating lifetime users:', error);
    throw error;
  }
}

// Run the script
fixLifetimeUsers()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

