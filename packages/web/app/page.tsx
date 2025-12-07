import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getUserBillingCycle } from './actions';

// Force dynamic rendering to avoid static generation issues with Clerk
export const dynamic = 'force-dynamic';

export default async function MainPage() {
  if (process.env.ENABLE_USER_MANAGEMENT !== 'true') {
    redirect('/dashboard/self-hosted');
  }

  const { userId } = await auth();

  const billingCycle = await getUserBillingCycle(userId);
  console.log('Billing cycle:', billingCycle);

  // if billing cycle part of legacy plans
  const isSubscription = [
    // legacy cycle
    'monthly',
    'yearly',
    // new up to date cycle
    'subscription',
  ].includes(billingCycle);

  // top-up is not a subscription plan
  const isPayOnce = ['pay-once'].includes(billingCycle);

  // Check if the user has any kind of active subscription
  const hasSubscription = isSubscription || isPayOnce;

  if (hasSubscription) {
    // If user has any kind of subscription, redirect to dashboard
    redirect('/dashboard');
  } else {
    // If user doesn't have a subscription, redirect to the new onboarding page
    redirect('/onboarding');
  }
}
