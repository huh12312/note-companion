import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/handleAuthorization';
import { verifyKey } from '@unkey/api';

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request);

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 });
    }

    // Only verify the key validity - don't check subscription or token usage
    // This endpoint is specifically for license key validation in settings
    const { result } = await verifyKey(token);

    if (!result.valid) {
      return NextResponse.json(
        {
          error: 'Invalid key',
          message: 'Please provide a valid license key',
        },
        { status: 401 }
      );
    }

    // Key is valid - return success
    // Note: We don't check subscription status here because this endpoint
    // is only for validating that the key format/structure is correct
    return NextResponse.json(
      {
        message: 'Valid key',
        userId: result.ownerId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.log('Error checking key', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 });
  }
}
