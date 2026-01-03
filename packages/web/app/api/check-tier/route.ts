import { NextResponse, NextRequest } from 'next/server';
import { checkIfUserNeedsUpgrade, checkTokenUsage } from '@/drizzle/schema';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';

/**
 * @deprecated This endpoint is deprecated. Use /api/token-usage instead.
 * This endpoint returns minimal data: { needsUpgrade, remainingTokens, usageError }.
 * The /api/token-usage endpoint provides the same data plus additional fields:
 * - Full user usage data (tokenUsage, maxTokenUsage, subscriptionStatus, etc.)
 * - percentUsed calculation
 * - availableTiers information
 *
 * Migration: Change `/api/check-tier` to `/api/token-usage` in your client code.
 * The token-usage endpoint returns all check-tier fields plus additional data.
 *
 * This endpoint will be removed in a future release.
 */
export async function GET(request: NextRequest) {
  // Log deprecation warning
  console.warn(
    '[DEPRECATED] /api/check-tier endpoint called. This endpoint is deprecated. ' +
      'Please migrate to /api/token-usage for the same data plus additional fields. ' +
      'This endpoint will be removed in a future release.'
  );

  try {
    const { userId } = await handleAuthorizationV2(request);

    // Check if user needs to upgrade
    const needsUpgrade = await checkIfUserNeedsUpgrade(userId);

    // Get token usage information
    const tokenUsage = await checkTokenUsage(userId);

    // Return response with deprecation warning in headers
    return NextResponse.json(
      {
        needsUpgrade,
        remainingTokens: tokenUsage.remaining,
        usageError: tokenUsage.usageError,
        // Include deprecation notice in response for client awareness
        _deprecated: true,
        _migration:
          'Please migrate to /api/token-usage for the same data plus additional fields (full user usage, percentUsed, availableTiers)',
      },
      {
        headers: {
          'X-Deprecated-Endpoint': 'true',
          'X-Migration-Endpoint': '/api/token-usage',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
