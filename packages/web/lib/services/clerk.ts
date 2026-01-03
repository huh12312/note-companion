import { clerkClient } from "@clerk/nextjs/server";
import { CustomerData } from '../../app/api/webhook/types';

export async function updateClerkMetadata(data: CustomerData) {
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(data.userId, {
      publicMetadata: {
        stripe: {
          customerId: data.customerId,
          status: data.status,
          payment: data.paymentStatus,
          product: data.product,
          plan: data.plan,
          billingCycle: data.billingCycle,
          lastPayment: data.lastPayment,
        },
      },
    });

    console.log(`Updated Clerk metadata for user ${data.userId}`);
  } catch (error: any) {
    // Handle case where user doesn't exist in Clerk (404)
    // This can happen when user is deleted from Clerk but subscription still exists
    if (error?.status === 404 || error?.clerkError === true) {
      console.warn(
        `Clerk user ${data.userId} not found, skipping metadata update. This is expected if the user was deleted from Clerk.`
      );
      return; // Don't throw - this is a non-critical error
    }

    // For other errors, log and re-throw
    console.error('Error updating Clerk metadata:', error);
    throw error;
  }
}