import { guessRelevantFolder } from '../aiService';
import { NextRequest, NextResponse } from 'next/server';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';
import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';
import { getModel } from '@/lib/models';

/**
 * @deprecated This endpoint is deprecated. Use /api/folders/v2 instead.
 * This endpoint returns a single folder suggestion, while v2 returns multiple suggestions with scores.
 *
 * Migration: Change `/api/folders` to `/api/folders/v2` in your client code.
 * The v2 endpoint returns `{ folders: [...] }` instead of `{ folder: "..." }`.
 *
 * This endpoint will be removed in a future release.
 */
export async function POST(request: NextRequest) {
  // Log deprecation warning
  console.warn(
    '[DEPRECATED] /api/folders endpoint called. This endpoint is deprecated. ' +
      'Please migrate to /api/folders/v2. ' +
      'This endpoint will be removed in a future release.'
  );

  try {
    const { userId } = await handleAuthorizationV2(request);
    const { content, fileName, folders, customInstructions } =
      await request.json();
    const model = getModel();
    const response = await guessRelevantFolder(
      content,
      fileName,
      folders,
      model as any,
      customInstructions
    );
    // increment tokenUsage
    const tokens = response.usage.totalTokens;
    console.log('incrementing token usage folders', userId, tokens);
    await incrementAndLogTokenUsage(userId, tokens);

    // Return response with deprecation warning in headers
    return NextResponse.json(
      {
        folder: response.object.suggestedFolder,
        // Include deprecation notice in response for client awareness
        _deprecated: true,
        _migration:
          'Please migrate to /api/folders/v2 for multiple folder suggestions with scores',
      },
      {
        headers: {
          'X-Deprecated-Endpoint': 'true',
          'X-Migration-Endpoint': '/api/folders/v2',
        },
      }
    );
  } catch (error) {
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
  }
}
