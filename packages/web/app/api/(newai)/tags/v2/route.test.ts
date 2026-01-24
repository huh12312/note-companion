import { NextRequest } from 'next/server';
import { POST } from './route';
import { generateObject } from 'ai';
import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';
import { getModel } from '@/lib/models';

// Mock dependencies
jest.mock('ai', () => ({
  generateObject: jest.fn(),
}));

jest.mock('@/lib/incrementAndLogTokenUsage', () => ({
  incrementAndLogTokenUsage: jest.fn(),
}));

jest.mock('@/lib/models', () => ({
  getModel: jest.fn(),
}));

jest.mock('@/lib/handleAuthorization', () => {
  // Must call requireActual inside the factory function
  const actual = jest.requireActual<typeof import('@/lib/handleAuthorization')>('@/lib/handleAuthorization');
  return {
    __esModule: true,
    // Export the real AuthorizationError class so instanceof checks work
    AuthorizationError: actual.AuthorizationError,
    handleAuthorizationV2: jest.fn().mockResolvedValue({ userId: 'test-user-id' }),
    getToken: actual.getToken,
  };
});

describe('POST /api/(newai)/tags/v2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getModel as jest.Mock).mockReturnValue({ modelId: 'gpt-4o-mini' });
    (incrementAndLogTokenUsage as jest.Mock).mockResolvedValue({
      remaining: 1000,
      usageError: false,
    });
  });

  describe('Happy Path', () => {
    it('should generate tags and return sorted tags with scores', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 90, isNew: false, tag: 'meeting', reason: 'Content is about meetings' },
            { score: 75, isNew: true, tag: 'planning', reason: 'Discusses planning' },
            { score: 60, isNew: false, tag: 'notes', reason: 'Meeting notes format' },
          ],
        },
        usage: { totalTokens: 200 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Meeting notes from today',
          fileName: 'meeting.md',
          existingTags: ['meeting', 'notes'],
          count: 3,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toHaveLength(3);
      expect(data.tags[0].score).toBe(90); // Sorted by score descending
      expect(data.tags[0].tag).toBe('#meeting'); // Should have # prefix
      expect(data.tags[1].tag).toBe('#planning');
      expect(data.tags[2].tag).toBe('#notes');
      expect(incrementAndLogTokenUsage).toHaveBeenCalledWith(
        'test-user-id',
        200
      );
    });

    it('should add # prefix to tags that do not have it', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 80, isNew: true, tag: 'newtag', reason: 'New tag' },
            { score: 70, isNew: false, tag: '#existing', reason: 'Existing tag' },
          ],
        },
        usage: { totalTokens: 150 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          count: 2,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.tags[0].tag).toBe('#newtag');
      expect(data.tags[1].tag).toBe('#existing'); // Already has prefix
    });

    it('should handle custom instructions', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 85, isNew: true, tag: 'custom', reason: 'Custom tag' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          customInstructions: 'Use technical tags only',
          count: 1,
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.system).toContain('Follow these custom instructions: Use technical tags only');
    });

    it('should handle existing tags in prompt', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 80, isNew: false, tag: 'existing', reason: 'Existing' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          existingTags: ['tag1', 'tag2', 'tag3'],
          count: 1,
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.system).toContain('Consider existing tags: tag1, tag2, tag3');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication failures', async () => {
      const { handleAuthorizationV2 } = require('@/lib/handleAuthorization');
      const authError = new Error('Unauthorized') as any;
      authError.status = 401;
      handleAuthorizationV2.mockRejectedValueOnce(authError);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(generateObject).not.toHaveBeenCalled();
    });

    it('should handle AI service errors', async () => {
      (generateObject as jest.Mock).mockRejectedValueOnce(
        new Error('AI service unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('AI service unavailable');
    });

    it('should handle errors with status codes', async () => {
      const error = new Error('Rate limit exceeded') as any;
      error.status = 429;
      (generateObject as jest.Mock).mockRejectedValueOnce(error);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Rate limit exceeded');
    });

    it('should handle token increment errors gracefully', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 80, isNew: true, tag: 'tag', reason: 'Reason' },
          ],
        },
        usage: { totalTokens: 150 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);
      (incrementAndLogTokenUsage as jest.Mock).mockRejectedValueOnce(
        new Error('Token increment failed')
      );

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
        }),
      });

      // Token increment errors are caught and return 500
      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 50, isNew: true, tag: 'untitled', reason: 'No content' },
          ],
        },
        usage: { totalTokens: 50 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: '',
          fileName: 'file.md',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(generateObject).toHaveBeenCalled();
    });

    it('should handle empty existingTags array', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 80, isNew: true, tag: 'new', reason: 'New tag' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          existingTags: [],
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.system).toContain('Create new tags if needed');
    });

    it('should truncate long content using head+tail', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 80, isNew: true, tag: 'tag', reason: 'Reason' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const maxChars = 20000;
      const headChars = Math.floor(maxChars * 0.7);
      const tailChars = maxChars - headChars;
      const headSeed = 'H'.repeat(headChars);
      const tailSeed = 'T'.repeat(tailChars);
      const longContent = `${headSeed}MIDDLE${'M'.repeat(2000)}${tailSeed}`;
      const truncatedChars = longContent.length - maxChars;

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: longContent,
          fileName: 'file.md',
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.prompt).toContain(headSeed);
      expect(callArgs.prompt).toContain(tailSeed);
      expect(callArgs.prompt).toContain(`...[truncated ${truncatedChars} chars]...`);
    });

    it('should not truncate when content is under the limit', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 80, isNew: true, tag: 'tag', reason: 'Reason' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const content = 'Short content';
      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content,
          fileName: 'file.md',
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.prompt).toContain(content);
      expect(callArgs.prompt).not.toContain('...[truncated');
    });

    it('should not truncate when content is exactly at the limit', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 80, isNew: true, tag: 'tag', reason: 'Reason' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const content = 'C'.repeat(20000);
      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content,
          fileName: 'file.md',
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.prompt).toContain(content);
      expect(callArgs.prompt).not.toContain('...[truncated');
    });

    it('should handle non-string content by sending empty content', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 80, isNew: true, tag: 'tag', reason: 'Reason' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: { value: 'not-a-string' },
          fileName: 'file.md',
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.prompt).not.toContain('not-a-string');
    });

    it('should handle custom count parameter', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 80, isNew: true, tag: 'tag1', reason: 'Tag 1' },
            { score: 70, isNew: true, tag: 'tag2', reason: 'Tag 2' },
            { score: 60, isNew: true, tag: 'tag3', reason: 'Tag 3' },
            { score: 50, isNew: true, tag: 'tag4', reason: 'Tag 4' },
            { score: 40, isNew: true, tag: 'tag5', reason: 'Tag 5' },
          ],
        },
        usage: { totalTokens: 200 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          count: 5,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.tags).toHaveLength(5);
      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.system).toContain('suggest 5 relevant tags');
    });

    it('should handle missing count parameter (defaults to 3)', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 80, isNew: true, tag: 'tag', reason: 'Reason' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.system).toContain('suggest 3 relevant tags');
    });

    it('should handle empty customInstructions', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 80, isNew: true, tag: 'tag', reason: 'Reason' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          customInstructions: '',
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.system).not.toContain('Follow these custom instructions');
    });

    it('should sort tags by score descending', async () => {
      const mockResponse = {
        object: {
          suggestedTags: [
            { score: 50, isNew: true, tag: 'low', reason: 'Low score' },
            { score: 90, isNew: true, tag: 'high', reason: 'High score' },
            { score: 70, isNew: true, tag: 'medium', reason: 'Medium score' },
          ],
        },
        usage: { totalTokens: 150 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/tags/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.tags[0].score).toBe(90);
      expect(data.tags[1].score).toBe(70);
      expect(data.tags[2].score).toBe(50);
    });
  });
});

