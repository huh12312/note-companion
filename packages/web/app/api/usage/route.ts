import { NextRequest, NextResponse } from 'next/server';
import { db, UserUsageTable } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import {
  handleAuthorizationV2,
  AuthorizationError,
} from '@/lib/handleAuthorization';

export async function GET(request: NextRequest) {
  try {
    // This will throw an error if not authorized
    const { userId } = await handleAuthorizationV2(request);

    // Get usage information
    const userUsage = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, userId))
      .limit(1);

    if (!userUsage.length) {
      return NextResponse.json({
        tokenUsage: 0,
        maxTokenUsage: 100000, // Default legacy plan tokens
        audioTranscriptionMinutes: 0,
        maxAudioTranscriptionMinutes: 0, // Default to 0 for legacy/free tier
        subscriptionStatus: 'active',
        currentPlan: 'Legacy Plan',
        isActive: true,
      });
    }

    // Lifetime licenses are always active
    const isActive =
      userUsage[0].billingCycle === 'lifetime' ||
      userUsage[0].subscriptionStatus === 'active';

    return NextResponse.json({
      tokenUsage: userUsage[0].tokenUsage || 0,
      maxTokenUsage: userUsage[0].maxTokenUsage || 100000,
      audioTranscriptionMinutes: userUsage[0].audioTranscriptionMinutes || 0,
      maxAudioTranscriptionMinutes:
        userUsage[0].maxAudioTranscriptionMinutes || 0,
      subscriptionStatus: userUsage[0].subscriptionStatus || 'inactive',
      currentPlan: userUsage[0].currentPlan || 'Legacy Plan',
      isActive,
    });
  } catch (error: unknown) {
    // Handle AuthorizationError with proper status code
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message || 'Authorization failed' },
        { status: error.status || 403 }
      );
    }

    // Check for AuthorizationError by name (for cases where instanceof doesn't work)
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AuthorizationError' &&
      'status' in error &&
      'message' in error
    ) {
      return NextResponse.json(
        { error: (error.message as string) || 'Authorization failed' },
        { status: (error.status as number) || 403 }
      );
    }

    // Handle token limit errors specially
    if (
      error instanceof Error &&
      error.message.includes('Token limit exceeded')
    ) {
      return NextResponse.json(
        {
          error:
            'Token limit exceeded. Please upgrade your plan for more tokens.',
        },
        { status: 429 }
      );
    }

    console.error('Error fetching usage data:', error);
    const errorStatus =
      error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof error.status === 'number'
        ? error.status
        : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch usage data',
      },
      { status: errorStatus }
    );
  }
}
