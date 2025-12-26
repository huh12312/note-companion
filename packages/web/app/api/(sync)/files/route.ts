import { NextRequest, NextResponse } from 'next/server';
import { getFiles } from '@/app/dashboard/sync/actions';
import { auth } from '@clerk/nextjs/server';
import {
  handleAuthorizationV2,
  AuthorizationError,
} from '@/lib/handleAuthorization';
import { request } from 'http';

// Define the response type locally to avoid importing from actions
type FilesResponse = {
  files: Array<{
    id: number;
    originalName: string;
    fileType: string;
    status: string;
    createdAt: Date;
    tokensUsed: number | null;
    error: string | null;
    textContent: string | null;
    blobUrl: string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);

    if (userId) {
      // Continue with the request for mobile app with token
      const page = parseInt(
        request.nextUrl.searchParams.get('page') || '1',
        10
      );
      const limit = parseInt(
        request.nextUrl.searchParams.get('limit') || '10',
        10
      );

      // Pass the token to getFiles for mobile authentication
      const result = await getFiles({ page, limit }, userId);

      if ('error' in result) {
        return NextResponse.json(
          { error: result.error },
          { status: result.error === 'Unauthorized' ? 401 : 500 }
        );
      }

      return NextResponse.json(result as FilesResponse);
    } else if (!userId) {
      console.error('Unauthorized files list attempt - no userId or token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Regular web authentication flow
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(
      request.nextUrl.searchParams.get('limit') || '10',
      10
    );

    const result = await getFiles({ page, limit });

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'Unauthorized' ? 401 : 500 }
      );
    }

    return NextResponse.json(result as FilesResponse);
  } catch (error) {
    // Handle AuthorizationError with proper status code and message
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

    console.error('List files error:', error);
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    );
  }
}
