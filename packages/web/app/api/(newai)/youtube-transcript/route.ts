import { NextRequest, NextResponse } from 'next/server';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';
import { Innertube } from 'youtubei.js';
import { fetchTranscript } from 'youtube-transcript-plus';

export const runtime = 'nodejs';
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
export async function GET(_request: NextRequest) {
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
      // Try youtube-transcript-plus FIRST (works independently, doesn't need YouTube.js)
      console.log(
        '[YouTube API] Attempting to fetch transcript using youtube-transcript-plus (independent method)...'
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

        // Get video title using YouTube.js (for title only)
        let title = 'Untitled YouTube Video';
        try {
          const yt = await getYoutubeInstance();
          const videoInfo = await yt.getBasicInfo(videoId);
          title = videoInfo.basic_info?.title || 'Untitled YouTube Video';
        } catch (titleError) {
          console.warn('[YouTube API] Could not fetch title, using default');
        }

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
          '[YouTube API] youtube-transcript-plus failed:',
          transcriptPlusError.name,
          transcriptPlusError.message
        );
        console.error('[YouTube API] youtube-transcript-plus detailed error:', {
          name: transcriptPlusError.name,
          message: transcriptPlusError.message,
          stack: transcriptPlusError.stack,
          // Log any additional error properties that might contain HTTP details
          responseStatus: (transcriptPlusError as any).responseStatus,
          responseBody: (transcriptPlusError as any).responseBody,
          statusCode: (transcriptPlusError as any).statusCode,
          status: (transcriptPlusError as any).status,
          code: (transcriptPlusError as any).code,
          cause: (transcriptPlusError as any).cause,
          // Log all enumerable properties
          allProperties: Object.keys(transcriptPlusError),
        });
        // Fall through to YouTube.js method
      }

      // Fallback to YouTube.js method
      console.log('[YouTube API] Falling back to YouTube.js method...');
      const yt = await getYoutubeInstance();
      const videoInfo = await yt.getBasicInfo(videoId);

      // Log videoInfo structure for debugging
      console.log('[YouTube API] VideoInfo structure:', {
        hasBasicInfo: !!videoInfo.basic_info,
        basicInfoKeys: videoInfo.basic_info
          ? Object.keys(videoInfo.basic_info)
          : [],
        hasCaptions: !!videoInfo.captions,
        videoInfoKeys: Object.keys(videoInfo),
        videoInfoType: typeof videoInfo,
      });

      // Get video title - try multiple sources
      let title = 'Untitled YouTube Video';
      if (videoInfo.basic_info?.title) {
        title = videoInfo.basic_info.title;
      } else if ((videoInfo as any).primary_info?.title) {
        title = (videoInfo as any).primary_info.title;
      } else if ((videoInfo as any).secondary_info?.title) {
        title = (videoInfo as any).secondary_info.title;
      }
      console.log(`[YouTube API] Video title: ${title}`);

      if (title === 'Untitled YouTube Video') {
        console.warn(
          '[YouTube API] Warning: Could not find title in any source!'
        );
        console.log(
          '[YouTube API] primary_info:',
          (videoInfo as any).primary_info
        );
        console.log(
          '[YouTube API] secondary_info:',
          (videoInfo as any).secondary_info
        );
      }

      // Check caption availability - inspect more carefully
      console.log('[YouTube API] Checking caption availability...');
      const captions = videoInfo.captions;

      console.log('[YouTube API] Captions inspection:', {
        captionsType: typeof captions,
        captionsValue: captions,
        isNull: captions === null,
        isUndefined: captions === undefined,
        captionsKeys: captions ? Object.keys(captions) : [],
      });

      if (!captions) {
        console.log(
          '[YouTube API] Captions object is null/undefined. Full videoInfo:',
          {
            keys: Object.keys(videoInfo),
            hasStreamingData: !!videoInfo.streaming_data,
            hasPlayabilityStatus: !!videoInfo.playability_status,
            playabilityStatus: (videoInfo as any).playability_status,
          }
        );

        // Check if this is a bot detection issue
        const playabilityStatus = (videoInfo as any).playability_status;
        if (
          playabilityStatus?.status === 'ERROR' ||
          playabilityStatus?.reason
        ) {
          console.error(
            '[YouTube API] Playability error detected:',
            playabilityStatus
          );
          throw new Error(
            `YouTube returned an error: ${
              playabilityStatus.reason || 'Unknown error'
            } - This may be due to bot detection or regional restrictions.`
          );
        }

        throw new Error(
          'No captions found via YouTube.js - video may not have captions enabled, or YouTube may be blocking the request'
        );
      }

      console.log(
        `[YouTube API] Captions object found. Caption tracks: ${
          captions.caption_tracks?.length || 0
        }`
      );

      if (!captions.caption_tracks || captions.caption_tracks.length === 0) {
        console.warn(
          '[YouTube API] No caption tracks available. Available keys:',
          Object.keys(captions)
        );
        throw new Error(
          'No caption tracks available - video may not have captions enabled'
        );
      }

      console.log(
        `[YouTube API] Found ${captions.caption_tracks.length} caption track(s)`
      );

      // Log available caption tracks
      console.log(
        '[YouTube API] Available caption tracks:',
        captions.caption_tracks.map((t: any) => {
          const name =
            typeof t.name === 'string'
              ? t.name
              : t.name?.simple_text || t.name?.text || 'Unknown';
          return {
            language: t.language_code,
            name: name,
            isTranslatable: t.is_translatable,
          };
        })
      );

      // Use YouTube.js method to fetch transcript
      console.log(
        '[YouTube API] Using YouTube.js method to fetch transcript...',
        {
          hasCaptions: !!captions,
          captionTracksCount: captions.caption_tracks?.length || 0,
        }
      );

      // Try to fetch transcript using YouTube.js caption tracks
      const track =
        captions.caption_tracks.find((t: any) => t.language_code === 'fr') ||
        captions.caption_tracks[0];

      const trackName =
        typeof track.name === 'string'
          ? track.name
          : (track.name as any)?.simple_text ||
            (track.name as any)?.text ||
            'Unknown';
      console.log(
        `[YouTube API] Using caption track: ${track.language_code} (${trackName})`
      );

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
        console.error('[YouTube API] Session error details:', {
          message: sessionError.message,
          stack: sessionError.stack,
          name: sessionError.name,
        });
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
