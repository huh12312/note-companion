import { CustomerData } from '@/app/api/webhook/types';

interface LoopsEvent {
  email: string;
  firstName?: string;
  lastName?: string;
  userId: string;
  eventName: string;
  data?: Record<string, any>;
}

export async function trackLoopsEvent({
  email,
  firstName,
  lastName,
  userId,
  eventName,
  data = {}
}: LoopsEvent) {
  try {
    const response = await fetch('https://app.loops.so/api/v1/events/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
      },
      body: JSON.stringify({
        email,
        eventName,
        userId,
        firstName,
        lastName,
        userGroup: "StripeCustomers",
        ...data,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      // Handle "Multiple contacts" error by trying with just email
      // This can happen when there are duplicate contacts in Loops with the same userId
      if (errorData.message?.includes('Multiple contacts') && email) {
        console.warn(
          `Loops: Multiple contacts found for userId ${userId}, retrying with email only`
        );

        // Retry with just email (standard identifier)
        const retryResponse = await fetch('https://app.loops.so/api/v1/events/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
          },
          body: JSON.stringify({
            email, // Only send email, not userId
            eventName,
            firstName,
            lastName,
            userGroup: "StripeCustomers",
            ...data,
          }),
        });

        if (!retryResponse.ok) {
          const retryErrorText = await retryResponse.text();
          console.warn('Loops tracking failed (retry with email only):', retryErrorText);
        } else {
          console.log('Loops tracking succeeded with email only');
        }
      } else {
        // For other errors, log as warning since Loops tracking is non-critical
        console.warn('Loops tracking failed:', errorText);
      }
    }
  } catch (error) {
    // Log but don't throw to prevent webhook processing from failing
    console.error('Error tracking Loops event:', error);
  }
}