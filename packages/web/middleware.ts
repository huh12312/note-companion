import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const isApiRoute = createRouteMatcher(['/api(.*)']);

const isPublicRoute = createRouteMatcher([
  '/api(.*)',
  '/sign-in(.*)',
  '/webhook(.*)',
  '/top-up-success',
  '/top-up-cancelled',
  '/robots.txt',
]);

const isClerkProtectedRoute = createRouteMatcher(['/(.*)']);

// Check if Clerk is configured
const hasClerkConfig =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

const soloApiKeyMiddleware = (req: NextRequest) => {
  if (isApiRoute(req)) {
    const header = req.headers.get('authorization');
    console.log('header', header);
    if (!header) {
      return new NextResponse('No Authorization header', { status: 401 });
    }
    const token = header.replace('Bearer ', '');
    if (token !== process.env.SOLO_API_KEY) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }
  return NextResponse.next();
};

// Helper to check if a path is a static file that should be skipped
function isStaticFile(pathname: string): boolean {
  // Check for common static file patterns
  const staticPatterns = [
    /^\/apple-touch-icon/i,
    /^\/favicon\.ico$/i,
    /^\/robots\.txt$/i,
    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|css|js|txt)$/i,
  ];
  return staticPatterns.some((pattern) => pattern.test(pathname));
}

// Main middleware function that handles CORS and routing
async function baseMiddleware(req: NextRequest): Promise<NextResponse> {
  // Skip static files immediately (but allow /config.js through if it needs auth)
  if (
    isStaticFile(req.nextUrl.pathname) &&
    req.nextUrl.pathname !== '/config.js'
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  // Allow all origins
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    // Handle preflight requests
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const isSoloInstance =
    process.env.SOLO_API_KEY && process.env.SOLO_API_KEY.length > 0;

  // If not using Clerk and using solo instance, use API key middleware
  if (!hasClerkConfig && isSoloInstance) {
    return soloApiKeyMiddleware(req);
  }

  return res;
}

// Always export clerkMiddleware (required for Clerk's runtime detection)
// Branch inside the callback instead of conditionally exporting
// This ensures auth() can be called anywhere without "clerkMiddleware not detected" errors
export default clerkMiddleware(async (auth, req) => {
  // Always run base middleware logic first (CORS, OPTIONS, etc.)
  const baseResponse = await baseMiddleware(req);

  // If base middleware returned early (e.g., OPTIONS), use that response
  if (baseResponse.status === 204 || baseResponse.status !== 200) {
    return baseResponse;
  }

  // Skip static files - don't run Clerk auth on them
  // But allow /config.js through if it needs to call auth()
  if (
    isStaticFile(req.nextUrl.pathname) &&
    req.nextUrl.pathname !== '/config.js'
  ) {
    return NextResponse.next();
  }

  // If Clerk isn't configured, don't call auth() - just pass through
  // This prevents the "clerkMiddleware not detected" error
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.CLERK_SECRET_KEY
  ) {
    // If not using Clerk but using solo instance, handle API key auth
    const isSoloInstance =
      process.env.SOLO_API_KEY && process.env.SOLO_API_KEY.length > 0;
    if (isSoloInstance) {
      return soloApiKeyMiddleware(req);
    }
    return NextResponse.next();
  }

  // Handle public routes - always allow through without auth
  if (isPublicRoute(req)) {
    console.log('isPublicRoute');
    return NextResponse.next();
  }

  const enableUserManagement = process.env.ENABLE_USER_MANAGEMENT === 'true';

  // If user management is enabled, enforce authentication
  if (enableUserManagement) {
    console.log('enableUserManagement', req.url);
    if (isClerkProtectedRoute(req)) {
      console.log('isClerkProtectedRoute');
      // Only call auth() if Clerk is configured (we already checked above)
      const { userId } = await auth();
      console.log('userId', userId);
      if (!userId) {
        // (await auth()).redirectToSignIn();
      }
    }
  }
  // If user management is disabled, just pass through (permissive)
  // This allows auth() calls to work without enforcing authentication

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes - handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - apple-touch-icon.* (iOS icons with any extension)
     * - *.png, *.jpg, *.jpeg, *.gif, *.svg, *.ico (image files)
     * - *.woff, *.woff2, *.ttf, *.eot (font files)
     * - *.css, *.js, *.json (static assets)
     *
     * Note: /config.js is explicitly included in the matcher so middleware runs
     * and clerkMiddleware is detected, even if we skip auth() for it
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|apple-touch-icon.*|robots\\.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|css|js|json|txt)$).*)',
    '/',
    '/config.js', // Explicitly include config.js so middleware runs
    '/(api|trpc)(.*)',
  ],
};
