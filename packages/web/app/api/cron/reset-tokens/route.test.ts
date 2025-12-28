import { db, UserUsageTable } from '@/drizzle/schema';
import { PRODUCTS } from '@/srm.config';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { GET } from './route';
/**
 * @jest-environment node
 */

describe('Token Reset Cron Job', () => {
  const mockUserId = 'test-user-123';
  const monthlyTokenLimit = 5000 * 1000; // 5M tokens

  beforeEach(async () => {
    // Clear any existing test data
    try {
      await db
        .delete(UserUsageTable)
        .where(eq(UserUsageTable.userId, mockUserId));
    } catch (e) {
      // Ignore errors if record doesn't exist
    }

    // Setup test data
    await db.insert(UserUsageTable).values({
      userId: mockUserId,
      subscriptionStatus: 'active',
      paymentStatus: 'paid',
      tokenUsage: 1000000, // 1M tokens used
      maxTokenUsage: monthlyTokenLimit,
      billingCycle: 'subscription',
      currentPlan: PRODUCTS.SubscriptionMonthly.metadata.plan,
    });
  });

  afterEach(async () => {
    // Cleanup test data
    await db
      .delete(UserUsageTable)
      .where(eq(UserUsageTable.userId, mockUserId));
  });

  it('should reset token usage for active subscribers', async () => {
    const request = new NextRequest('http://localhost/api/cron/reset-tokens', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      success: true,
      message: 'Token and audio transcription usage reset successful',
      usersReset: expect.any(Number),
      freeTierUsersReset: expect.any(Number),
    });

    // Verify token usage was reset
    const userUsage = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, mockUserId));

    expect(userUsage[0].tokenUsage).toBe(0);
    expect(userUsage[0].maxTokenUsage).toBe(monthlyTokenLimit);
  });

  it('should not reset tokens for inactive subscriptions', async () => {
    // Update user to inactive
    await db
      .update(UserUsageTable)
      .set({ subscriptionStatus: 'inactive' })
      .where(eq(UserUsageTable.userId, mockUserId));

    const request = new NextRequest('http://localhost/api/cron/reset-tokens', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    // Verify token usage was not reset
    const userUsage = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, mockUserId));

    expect(userUsage[0].tokenUsage).toBe(1000000); // Should remain unchanged
  });

  it('should return 401 for unauthorized requests', async () => {
    const request = new NextRequest('http://localhost/api/cron/reset-tokens', {
      method: 'GET',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should handle database errors gracefully', async () => {
    // Save the original update implementation
    const originalUpdate = db.update;

    // Mock a database error by making the where() call reject
    // Replace db.update directly to ensure it's used
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).update = jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => {
          // Return a rejected promise
          return Promise.reject(new Error('Database error'));
        }),
      })),
    }));

    const request = new NextRequest('http://localhost/api/cron/reset-tokens', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const response = await GET(request);

    // Debug: Check what we actually got
    const status = response.status;
    const body = await response.json();

    // The error should be caught and return 500
    if (status !== 500) {
      console.log('Unexpected status:', status, 'Body:', body);
    }
    expect(status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: 'Failed to reset token usage',
    });

    // Restore the original update implementation
    db.update = originalUpdate;
  });

  describe('Top-up token preservation', () => {
    it('should preserve unused top-up tokens when resetting', async () => {
      // User with 10M total (5M subscription + 5M top-up), used 3M
      await db
        .update(UserUsageTable)
        .set({
          maxTokenUsage: monthlyTokenLimit + 5000000, // 10M total
          tokenUsage: 3000000, // 3M used (all from subscription)
        })
        .where(eq(UserUsageTable.userId, mockUserId));

      const request = new NextRequest('http://localhost/api/cron/reset-tokens', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      });

      await GET(request);

      const userUsage = await db
        .select()
        .from(UserUsageTable)
        .where(eq(UserUsageTable.userId, mockUserId));

      expect(userUsage[0].tokenUsage).toBe(0);
      expect(userUsage[0].maxTokenUsage).toBe(monthlyTokenLimit + 5000000); // 10M preserved
    });

    it('should preserve remaining top-up tokens when some were consumed', async () => {
      // User with 10M total (5M subscription + 5M top-up), used 8M
      await db
        .update(UserUsageTable)
        .set({
          maxTokenUsage: monthlyTokenLimit + 5000000, // 10M total
          tokenUsage: 8000000, // 8M used (5M subscription + 3M top-up)
        })
        .where(eq(UserUsageTable.userId, mockUserId));

      const request = new NextRequest('http://localhost/api/cron/reset-tokens', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      });

      await GET(request);

      const userUsage = await db
        .select()
        .from(UserUsageTable)
        .where(eq(UserUsageTable.userId, mockUserId));

      expect(userUsage[0].tokenUsage).toBe(0);
      // Should have 5M subscription + 2M remaining top-up = 7M
      expect(userUsage[0].maxTokenUsage).toBe(monthlyTokenLimit + 2000000);
    });

    it('should not restore consumed top-up tokens', async () => {
      // User with 10M total (5M subscription + 5M top-up), used 10M (all consumed)
      await db
        .update(UserUsageTable)
        .set({
          maxTokenUsage: monthlyTokenLimit + 5000000, // 10M total
          tokenUsage: 10000000, // 10M used (5M subscription + 5M top-up)
        })
        .where(eq(UserUsageTable.userId, mockUserId));

      const request = new NextRequest('http://localhost/api/cron/reset-tokens', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      });

      await GET(request);

      const userUsage = await db
        .select()
        .from(UserUsageTable)
        .where(eq(UserUsageTable.userId, mockUserId));

      expect(userUsage[0].tokenUsage).toBe(0);
      // Should have only 5M subscription, no top-up (all consumed)
      expect(userUsage[0].maxTokenUsage).toBe(monthlyTokenLimit);
    });

    it('should reset users without top-ups to 5M normally', async () => {
      // User with only subscription tokens, no top-up
      await db
        .update(UserUsageTable)
        .set({
          maxTokenUsage: monthlyTokenLimit, // 5M (subscription only)
          tokenUsage: 3000000, // 3M used
        })
        .where(eq(UserUsageTable.userId, mockUserId));

      const request = new NextRequest('http://localhost/api/cron/reset-tokens', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      });

      await GET(request);

      const userUsage = await db
        .select()
        .from(UserUsageTable)
        .where(eq(UserUsageTable.userId, mockUserId));

      expect(userUsage[0].tokenUsage).toBe(0);
      expect(userUsage[0].maxTokenUsage).toBe(monthlyTokenLimit); // 5M
    });

    it('should handle users with maxTokenUsage less than monthly limit', async () => {
      // Edge case: User with less than subscription limit (shouldn't happen, but handle gracefully)
      await db
        .update(UserUsageTable)
        .set({
          maxTokenUsage: 3000000, // 3M (less than subscription limit)
          tokenUsage: 2000000, // 2M used
        })
        .where(eq(UserUsageTable.userId, mockUserId));

      const request = new NextRequest('http://localhost/api/cron/reset-tokens', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      });

      await GET(request);

      const userUsage = await db
        .select()
        .from(UserUsageTable)
        .where(eq(UserUsageTable.userId, mockUserId));

      expect(userUsage[0].tokenUsage).toBe(0);
      // Should reset to subscription limit
      expect(userUsage[0].maxTokenUsage).toBe(monthlyTokenLimit);
    });
  });
});
