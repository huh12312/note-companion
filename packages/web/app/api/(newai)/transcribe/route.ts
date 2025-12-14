import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promises as fsPromises } from 'node:fs';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Unkey } from '@unkey/api';

export const maxDuration = 800; // Maximum allowed for Vercel Pro plan (13.3 minutes) for longer audio/video files

/**
 * Formats transcript text by adding paragraph breaks at natural points
 * to make it more readable.
 *
 * Breaks at:
 * - Periods followed by capital letters (sentence boundaries)
 * - Question marks and exclamation marks
 * - Natural pauses (multiple spaces)
 */
function formatTranscript(text: string): string {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // First, normalize multiple spaces to single spaces
  let formatted = text.replace(/\s+/g, ' ').trim();

  // Split into sentences by looking for sentence-ending punctuation
  // followed by a space and a capital letter
  const sentenceEndings = /([.!?])\s+([A-Z])/g;

  // Replace sentence endings with punctuation + double newline + capital letter
  formatted = formatted.replace(sentenceEndings, '$1\n\n$2');

  // Also handle cases where sentence ends with punctuation followed by quotes
  formatted = formatted.replace(/([.!?])\s*(["'])\s+([A-Z])/g, '$1$2\n\n$3');

  // Handle question marks and exclamation marks similarly
  formatted = formatted.replace(/([!?])\s+([A-Z])/g, '$1\n\n$2');

  // Clean up any triple or more newlines (should only have double)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  // Trim each paragraph
  formatted = formatted
    .split('\n\n')
    .map(para => para.trim())
    .filter(para => para.length > 0)
    .join('\n\n');

  return formatted;
}

export async function POST(request: Request) {
  let tempFilePath: string | null = null;

  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    const key = authHeader?.replace('Bearer ', '');

    if (!key) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Unkey v2: Use Unkey instance for verification
    const unkey = new Unkey({
      rootKey: process.env.UNKEY_ROOT_KEY || '',
    });

    // Try verifyKey method (v2 API) - takes object with 'key' property
    // Include apiId if available (keys are scoped to an API)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any = null;
    const apiId = process.env.UNKEY_API_ID;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifyParams: any = { key: key };
    if (apiId) {
      verifyParams.apiId = apiId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((unkey as any).keys?.verifyKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response = await (unkey as any).keys.verifyKey(verifyParams);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } else if ((unkey as any).verifyKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response = await (unkey as any).verifyKey(verifyParams);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } else if ((unkey as any).keys?.verify) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response = await (unkey as any).keys.verify(verifyParams);
    }

    // Handle v2 response format (wrapped in data) or v1 format (direct result)
    const result =
      response && ('data' in response ? response.data : response.result);
    const error = response?.error;

    if (error || !result || !result.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let extension: string;

    if (contentType.includes('multipart/form-data')) {
      // Handle direct file upload from plugin (smaller files < 4MB)
      const formData = await request.formData();
      const audioFile = formData.get('audio') as File;

      if (!audioFile) {
        return NextResponse.json(
          { error: 'No audio file provided' },
          { status: 400 }
        );
      }

      extension = audioFile.name.split('.').pop()?.toLowerCase() || 'webm';
      const arrayBuffer = await audioFile.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      tempFilePath = join(tmpdir(), `upload_${Date.now()}.${extension}`);
      await fsPromises.writeFile(tempFilePath, buffer);
    } else if (contentType.includes('application/json')) {
      const body = await request.json();

      // Handle pre-signed URL flow (larger files > 4MB)
      if (body.fileUrl && body.key) {
        return handlePresignedUrlTranscription(
          body.fileUrl,
          body.extension || 'webm'
        );
      }

      // Handle base64 upload (from audio recorder)
      if (body.audio && body.extension) {
        extension = body.extension;
        const base64Data = body.audio.split(';base64,').pop();
        if (!base64Data) {
          return NextResponse.json(
            { error: 'Invalid base64 data' },
            { status: 400 }
          );
        }

        tempFilePath = join(tmpdir(), `upload_${Date.now()}.${extension}`);
        await fsPromises.writeFile(tempFilePath, base64Data, {
          encoding: 'base64',
        });
      } else {
        return NextResponse.json(
          { error: 'Missing audio data' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
    });

    // Check file size
    const stats = await fsPromises.stat(tempFilePath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    if (fileSizeInMB > 25) {
      // File is too large for OpenAI's Whisper API (25MB limit)
      if (tempFilePath) await fsPromises.unlink(tempFilePath);
      return NextResponse.json(
        {
          error:
            'Audio file is too large. Please use a file smaller than 25MB. Consider compressing or splitting the audio file.',
        },
        { status: 400 }
      );
    }

    // Process the audio file
    console.log(
      `[Transcribe] Starting transcription for file: ${tempFilePath}, size: ${fileSizeInMB.toFixed(
        2
      )}MB`
    );
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
    });

    // Log transcript length for debugging
    const transcriptLength = transcription.text.length;
    console.log(
      `[Transcribe] Transcription completed. Transcript length: ${transcriptLength} characters`
    );

    // Format the transcript for better readability
    const formattedText = formatTranscript(transcription.text);

    // Clean up temp file
    if (tempFilePath) await fsPromises.unlink(tempFilePath);

    return NextResponse.json({
      text: formattedText,
      length: transcriptLength, // Include length for debugging
    });
  } catch (error) {
    console.error('Transcription error:', error);

    // Clean up temp file on error
    if (tempFilePath) {
      try {
        await fsPromises.unlink(tempFilePath);
      } catch (unlinkError) {
        // Ignore cleanup errors
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to process audio',
        details:
          'Audio transcription failed. Please check file format and size.',
      },
      { status: 500 }
    );
  }
}

async function handlePresignedUrlTranscription(
  fileUrl: string,
  extension: string
): Promise<NextResponse> {
  let tempFilePath: string | null = null;

  try {
    // Download the file from R2
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(
        `Failed to download file from R2: ${fileResponse.status}`
      );
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Save to temp file
    tempFilePath = join(tmpdir(), `r2_audio_${Date.now()}.${extension}`);
    await fsPromises.writeFile(tempFilePath, buffer);

    // Check file size
    const stats = await fsPromises.stat(tempFilePath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    if (fileSizeInMB > 25) {
      await fsPromises.unlink(tempFilePath);
      return NextResponse.json(
        {
          error:
            'Audio file is too large. Please use a file smaller than 25MB.',
        },
        { status: 400 }
      );
    }

    // Transcribe using OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
    });

    console.log(
      `[Transcribe R2] Starting transcription for file from R2: ${tempFilePath}, size: ${fileSizeInMB.toFixed(
        2
      )}MB`
    );
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
    });

    // Log transcript length for debugging
    const transcriptLength = transcription.text.length;
    console.log(
      `[Transcribe R2] Transcription completed. Transcript length: ${transcriptLength} characters`
    );

    // Format the transcript for better readability
    const formattedText = formatTranscript(transcription.text);

    // Clean up
    await fsPromises.unlink(tempFilePath);

    return NextResponse.json({
      text: formattedText,
      length: transcriptLength, // Include length for debugging
    });
  } catch (error) {
    console.error('Pre-signed URL transcription error:', error);

    if (tempFilePath) {
      try {
        await fsPromises.unlink(tempFilePath);
      } catch (unlinkError) {
        // Ignore cleanup errors
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process audio from R2',
      },
      { status: 500 }
    );
  }
}
