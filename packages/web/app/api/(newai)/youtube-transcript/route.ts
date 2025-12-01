import { NextRequest, NextResponse } from 'next/server';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';
import { Innertube } from 'youtubei.js';
import { fetchTranscript } from 'youtube-transcript-plus';

export const maxDuration = 60;

// Cache the Innertube instance
let ytInstance: Innertube | null = null;

async function getYoutubeInstance(): Promise<Innertube> {
  if (!ytInstance) {
    console.log('[YouTube API] Creating Innertube instance...');
    ytInstance = await Innertube.create();
    console.log('[YouTube API] Innertube instance created');
  }
  return ytInstance;
}

/**
 * Fetches YouTube video transcript and title using YouTube.js
 * POST /api/youtube-transcript
 * Body: { videoId: string }
 * 
 * GET /api/youtube-transcript - Health check endpoint
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'YouTube Transcript API is available',
    method: 'Use POST with { videoId: string } in the request body',
    endpoint: '/api/youtube-transcript',
  });
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const { userId } = await handleAuthorizationV2(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId } = await request.json();
    if (!videoId || typeof videoId !== 'string') {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }

    console.log(`[YouTube API] Fetching transcript for video: ${videoId}`);

    try {
      // Try youtube-transcript-plus first (more reliable)
      console.log(
        '[YouTube API] Attempting to fetch transcript using youtube-transcript-plus...'
      );
      try {
        const transcriptItems = await fetchTranscript(videoId);

        if (!transcriptItems || transcriptItems.length === 0) {
          throw new Error('No transcript items returned');
        }

        // Combine transcript text
        const transcript = transcriptItems
          .map((item: { text: string }) => item.text)
          .join(' ');

        // Get video title using YouTube.js
        const yt = await getYoutubeInstance();
        const videoInfo = await yt.getBasicInfo(videoId);
        const title = videoInfo.basic_info?.title || 'Untitled YouTube Video';

        console.log(
          `[YouTube API] Successfully fetched transcript using youtube-transcript-plus: ${transcript.length} chars`
        );

        return NextResponse.json({
          title,
          transcript,
          videoId,
        });
      } catch (transcriptPlusError: any) {
        console.warn(
          '[YouTube API] youtube-transcript-plus failed, falling back to YouTube.js:',
          transcriptPlusError.message
        );
        // Fall through to YouTube.js method
      }

      // Fallback to YouTube.js method
      const yt = await getYoutubeInstance();

      console.log('[YouTube API] Fetching video info using YouTube.js...');
      const videoInfo = await yt.getBasicInfo(videoId);

      // Get video title
      const title = videoInfo.basic_info?.title || 'Untitled YouTube Video';

      console.log('[YouTube API] Getting captions...');
      const captions = videoInfo.captions;

      if (
        !captions ||
        !captions.caption_tracks ||
        captions.caption_tracks.length === 0
      ) {
        return NextResponse.json(
          {
            error:
              'Transcript not available - video may not have captions enabled',
          },
          { status: 404 }
        );
      }

      // Try to fetch transcript using YouTube.js caption tracks
      const track =
        captions.caption_tracks.find((t: any) => t.language_code === 'fr') ||
        captions.caption_tracks[0];

      console.log(`[YouTube API] Using caption track: ${track.language_code}`);

      if (!track.base_url) {
        return NextResponse.json(
          {
            error: 'No transcript URL available for this video',
          },
          { status: 404 }
        );
      }

      // Fetch the transcript XML
      console.log('[YouTube API] Fetching transcript content from base_url...');
      let transcriptResponse: Response;
      try {
        transcriptResponse = await yt.session.http.fetch(track.base_url, {
          method: 'GET',
        });
        console.log('[YouTube API] Fetched via Innertube session');
      } catch (sessionError: any) {
        console.warn(
          '[YouTube API] Innertube session fetch failed, trying direct fetch:',
          sessionError.message
        );
        // Fallback to direct fetch
        transcriptResponse = await fetch(track.base_url, {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/xml, text/xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: `https://www.youtube.com/watch?v=${videoId}`,
            Origin: 'https://www.youtube.com',
          },
        });
      }

      if (!transcriptResponse.ok) {
        const errorText = await transcriptResponse.text().catch(() => '');
        console.error(
          '[YouTube API] Transcript fetch failed:',
          transcriptResponse.status,
          errorText.substring(0, 200)
        );
        throw new Error(
          `Failed to fetch transcript: ${transcriptResponse.status} ${transcriptResponse.statusText}`
        );
      }

      const transcriptXml = await transcriptResponse.text();
      if (!transcriptXml || transcriptXml.length === 0) {
        throw new Error(
          'Transcript response is empty - the URL may have expired or been blocked'
        );
      }

      // Parse XML to extract text
      const textMatches = transcriptXml.match(/<text[^>]*>(.*?)<\/text>/gs);
      if (!textMatches || textMatches.length === 0) {
        throw new Error(
          'Failed to parse transcript XML - no text segments found'
        );
      }

      const transcript = textMatches
        .map((match) => {
          const text = match
            .replace(/<[^>]*>/g, '')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&apos;/g, "'")
            .trim();
          return text;
        })
        .filter((text) => text.length > 0)
        .join(' ');

      console.log(
        `[YouTube API] Successfully fetched transcript: ${transcript.length} chars, title: ${title}`
      );

      return NextResponse.json({
        title,
        transcript,
        videoId,
      });
    } catch (transcriptError: any) {
      console.error(
        '[YouTube API] Error fetching transcript:',
        transcriptError
      );
      const errorMessage = transcriptError?.message || 'Unknown error';

      if (
        errorMessage.includes('Transcript is disabled') ||
        errorMessage.includes('not available')
      ) {
        return NextResponse.json(
          { error: 'Transcript is not available for this video' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: `Failed to fetch YouTube transcript: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[YouTube API] Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch YouTube transcript: ${errorMessage}` },
      { status: 500 }
    );
  }
}
