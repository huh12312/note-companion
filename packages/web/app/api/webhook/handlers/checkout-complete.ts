import { UserUsageTable, db } from '@/drizzle/schema';
import { createWebhookHandler } from '../handler-factory';
import { trackLoopsEvent } from '@/lib/services/loops';
import Stripe from 'stripe';
import { config, ProductMetadata } from '@/srm.config';
import { sql } from 'drizzle-orm';

// sample yearly metadata
// "metadata": {
// "plan":
// "yearly",
// "type":
// "subscription",
// "userId":
// "user_2fxYYN5l4R3BkYc2UW4yuMTHj2G",
// },

const handleSubscription = async (
  session: Stripe.Checkout.Session & { metadata: ProductMetadata }
) => {
  const metadata = session.metadata;
  console.log('creating subscription with metadata', metadata);

  // Preserve remaining top-up tokens when subscribing or upgrading
  // Top-up tokens are one-time purchases that deplete when used
  const monthlyTokenLimit = 5000 * 1000; // 5 million tokens

  // insert or update
  await db
    .insert(UserUsageTable)
    .values({
      userId: metadata.userId,
      subscriptionStatus: 'active',
      paymentStatus: 'paid',
      maxTokenUsage: monthlyTokenLimit, // For new users, set to subscription limit
      maxAudioTranscriptionMinutes: 300, // 300 minutes per month for paid subscriptions
      billingCycle: metadata.type,
      lastPayment: new Date(),
      currentPlan: metadata.plan,
      currentProduct: metadata.type,
      hasCatalystAccess: true,
      tier: 'paid', // Explicitly set tier to paid
    })
    .onConflictDoUpdate({
      target: [UserUsageTable.userId],
      set: {
        subscriptionStatus: 'active',
        paymentStatus: 'paid',
        maxTokenUsage: sql`
          ${monthlyTokenLimit} + GREATEST(
            GREATEST(${UserUsageTable.maxTokenUsage} - ${monthlyTokenLimit}, 0) -
            GREATEST(${UserUsageTable.tokenUsage} - ${monthlyTokenLimit}, 0),
            0
          )
        `,
        maxAudioTranscriptionMinutes: 300, // 300 minutes per month for paid subscriptions
        billingCycle: metadata.type,
        lastPayment: new Date(),
        currentPlan: metadata.plan,
        currentProduct: metadata.type,
        hasCatalystAccess: true,
        tier: 'paid', // Explicitly set tier to paid
      },
    });

  console.log(`Updated subscription for user ${metadata.userId}`);
};

const handlePayOnce = async (
  session: Stripe.Checkout.Session & { metadata: ProductMetadata }
) => {
  const metadata = session.metadata;
  console.log('creating pay once with metadata', metadata);

  // Check if this is a lifetime license
  // Note: lifetime_license is not in the Plan type, so we check as string
  // Also check the raw session metadata which may have additional fields
  const rawMetadata = session.metadata as Record<string, string | undefined>;
  const isLifetimeLicense =
    (metadata.plan as string) === 'lifetime_license' ||
    (metadata.type as string) === 'lifetime' ||
    rawMetadata.billingCycle === 'lifetime';

  // Lifetime licenses get the same benefits as subscriptions
  const maxTokenUsage = isLifetimeLicense ? 5000 * 1000 : 0; // 5 million tokens for lifetime, 0 for top-ups
  const maxAudioTranscriptionMinutes = isLifetimeLicense ? 300 : 0; // 300 minutes for lifetime, 0 for top-ups
  const tier = isLifetimeLicense ? 'paid' : undefined; // Set tier to "paid" for lifetime licenses
  const subscriptionStatus = isLifetimeLicense ? 'active' : 'active'; // Both are active, but lifetime should stay active

  const values: any = {
    userId: metadata.userId,
    subscriptionStatus,
    paymentStatus: 'paid',
    maxTokenUsage,
    maxAudioTranscriptionMinutes,
    billingCycle: metadata.type,
    lastPayment: new Date(),
    currentPlan: metadata.plan,
    currentProduct: metadata.type,
    hasCatalystAccess: true,
  };

  // Only set tier for lifetime licenses
  if (tier) {
    values.tier = tier;
  }

  const updateData: any = {
    subscriptionStatus,
    paymentStatus: 'paid',
    lastPayment: new Date(),
    hasCatalystAccess: true,
    billingCycle: metadata.type,
    currentPlan: metadata.plan,
    currentProduct: metadata.type,
  };

  // For lifetime licenses, always set these values
  if (isLifetimeLicense) {
    updateData.maxTokenUsage = 5000 * 1000; // 5 million tokens
    updateData.maxAudioTranscriptionMinutes = 300; // 300 minutes per month
    updateData.tier = 'paid';
  }
  // For top-ups, don't update maxTokenUsage or maxAudioTranscriptionMinutes
  // (they should be additive for tokens, and we don't want to reset transcription limits)

  await db
    .insert(UserUsageTable)
    .values(values)
    .onConflictDoUpdate({
      target: [UserUsageTable.userId],
      set: updateData,
    });
};
async function handleTopUp(userId: string, tokens: number) {
  console.log('Handling top-up for user', userId, 'with', tokens, 'tokens');

  await db
    .insert(UserUsageTable)
    .values({
      userId,
      maxTokenUsage: tokens,
      tokenUsage: 0,
      subscriptionStatus: 'active',
      paymentStatus: 'succeeded',
      currentProduct: config.products.PayOnceTopUp.metadata.type,
      currentPlan: config.products.PayOnceTopUp.metadata.plan,
      billingCycle: config.products.PayOnceTopUp.metadata.type,
      lastPayment: new Date(),
      hasCatalystAccess: true,
    })
    .onConflictDoUpdate({
      target: [UserUsageTable.userId],
      set: {
        maxTokenUsage: sql`COALESCE(${UserUsageTable.maxTokenUsage}, 0) + ${tokens}`,
        lastPayment: new Date(),
        subscriptionStatus: 'active',
        paymentStatus: 'succeeded',
        hasCatalystAccess: true,
      },
    });
}

export const handleCheckoutComplete = createWebhookHandler(async (event) => {
  const session = event.data.object as Stripe.Checkout.Session;
  console.log('checkout complete', session);

  // Validate required metadata
  if (!session.metadata?.userId) {
    throw new Error('Missing required userId in metadata');
  }
  if (!session.metadata?.type) {
    throw new Error('Missing required type in metadata');
  }
  if (!session.metadata?.plan) {
    throw new Error('Missing required plan in metadata');
  }

  // either yearly or monthly subscription
  if (
    session.metadata?.plan ===
      config.products.SubscriptionYearly.metadata.plan ||
    session.metadata?.plan === config.products.SubscriptionMonthly.metadata.plan
  ) {
    await handleSubscription(
      session as Stripe.Checkout.Session & { metadata: ProductMetadata }
    );
  }
  // lifetime license - treat like subscription with full benefits
  else if (
    session.metadata?.plan === 'lifetime_license' ||
    session.metadata?.type === 'lifetime' ||
    session.metadata?.billingCycle === 'lifetime'
  ) {
    console.log('handling lifetime license', session.metadata);
    await handlePayOnce(
      session as Stripe.Checkout.Session & { metadata: ProductMetadata }
    );
  }
  // pay once top up
  else if (
    session.metadata?.plan === config.products.PayOnceTopUp.metadata.plan
  ) {
    console.log('handling top-up', session.metadata);
    if (!session.metadata.tokens) {
      throw new Error('Missing required tokens in metadata');
    }
    await handleTopUp(
      session.metadata.userId,
      parseInt(session.metadata.tokens)
    );
  }
  // fallback: any other pay-once product
  else if (session.metadata?.type === 'pay-once') {
    console.log('handling pay-once product', session.metadata);
    await handlePayOnce(
      session as Stripe.Checkout.Session & { metadata: ProductMetadata }
    );
  }

  if (session.customer_details?.email) {
    await trackLoopsEvent({
      email: session.customer_details.email,
      firstName: session.customer_details?.name?.split(' ')[0],
      lastName: session.customer_details?.name?.split(' ').slice(1).join(' '),
      userId: session.metadata?.userId,
      eventName: 'checkout_completed',
      data: {
        type: session.metadata?.type,
        plan: session.metadata?.plan,
      },
    });
  }

  return {
    success: true,
    message: `Successfully processed checkout for ${session.metadata?.userId}`,
  };
});
