import { logger } from "../../../services/logger";

/**
 * @deprecated These functions are deprecated. Use getYouTubeContent from youtube-service.ts instead.
 * The backend API provides reliable transcript fetching via YouTube.js.
 */
export async function getYouTubeTranscript(videoId: string): Promise<string> {
  console.warn(
    "[YouTube Transcript] Direct transcript fetching is deprecated. Use backend API via youtube-service.ts"
  );
  logger.warn(
    "[YouTube Transcript] Direct transcript fetching is deprecated. Use backend API via youtube-service.ts"
  );
  throw new Error(
    "Direct transcript fetching is not supported. Please use getYouTubeContent from youtube-service.ts which uses the backend API."
  );
}

/**
 * @deprecated This function is deprecated. Use getYouTubeContent from youtube-service.ts instead.
 * The backend API provides reliable title fetching via YouTube.js.
 */
export async function getYouTubeVideoTitle(videoId: string): Promise<string> {
  console.warn(
    "[YouTube Transcript] Direct title fetching is deprecated. Use backend API via youtube-service.ts"
  );
  logger.warn(
    "[YouTube Transcript] Direct title fetching is deprecated. Use backend API via youtube-service.ts"
  );
  throw new Error(
    "Direct title fetching is not supported. Please use getYouTubeContent from youtube-service.ts which uses the backend API."
  );
}
