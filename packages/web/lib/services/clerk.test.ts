import { updateClerkMetadata } from './clerk';
import { CustomerData } from '../../app/api/webhook/types';
import { clerkClient } from '@clerk/nextjs/server';

// Mock Clerk client
const mockUpdateUserMetadata = jest.fn();

jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: jest.fn(),
}));

describe('updateClerkMetadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (clerkClient as jest.Mock).mockResolvedValue({
      users: {
        updateUserMetadata: mockUpdateUserMetadata,
      },
    });
  });

  describe('Happy Path', () => {
    it('should update Clerk metadata with customer data', async () => {
      const customerData: CustomerData = {
        userId: 'user_123',
        customerId: 'cus_123',
        status: 'active',
        paymentStatus: 'paid',
        product: 'pro',
        plan: 'monthly',
        billingCycle: 'monthly',
        lastPayment: new Date('2024-01-01'),
      };

      mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

      await updateClerkMetadata(customerData);

      expect(mockUpdateUserMetadata).toHaveBeenCalledWith('user_123', {
        publicMetadata: {
          stripe: {
            customerId: 'cus_123',
            status: 'active',
            payment: 'paid',
            product: 'pro',
            plan: 'monthly',
            billingCycle: 'monthly',
            lastPayment: new Date('2024-01-01'),
          },
        },
      });
    });

    it('should handle all customer data fields', async () => {
      const customerData: CustomerData = {
        userId: 'user_456',
        customerId: 'cus_456',
        status: 'canceled',
        paymentStatus: 'unpaid',
        product: 'basic',
        plan: 'yearly',
        billingCycle: 'yearly',
        lastPayment: new Date('2023-12-01'),
      };

      mockUpdateUserMetadata.mockResolvedValueOnce(undefined);

      await updateClerkMetadata(customerData);

      expect(mockUpdateUserMetadata).toHaveBeenCalledWith('user_456', {
        publicMetadata: {
          stripe: {
            customerId: 'cus_456',
            status: 'canceled',
            payment: 'unpaid',
            product: 'basic',
            plan: 'yearly',
            billingCycle: 'yearly',
            lastPayment: new Date('2023-12-01'),
          },
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when Clerk client fails', async () => {
      const customerData: CustomerData = {
        userId: 'user_123',
        customerId: 'cus_123',
        status: 'active',
        paymentStatus: 'paid',
        product: 'pro',
        plan: 'monthly',
        billingCycle: 'monthly',
        lastPayment: new Date('2024-01-01'),
      };

      const error = new Error('Clerk API error');
      mockUpdateUserMetadata.mockRejectedValueOnce(error);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(updateClerkMetadata(customerData)).rejects.toThrow(
        'Clerk API error'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating Clerk metadata:',
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle 404 errors gracefully when user does not exist', async () => {
      const customerData: CustomerData = {
        userId: 'user_123',
        customerId: 'cus_123',
        status: 'active',
        paymentStatus: 'paid',
        product: 'pro',
        plan: 'monthly',
        billingCycle: 'monthly',
        lastPayment: new Date('2024-01-01'),
      };

      const error: any = new Error('Not Found');
      error.status = 404;
      error.clerkError = true;
      mockUpdateUserMetadata.mockRejectedValueOnce(error);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Should not throw
      await updateClerkMetadata(customerData);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Clerk user ${customerData.userId} not found, skipping metadata update. This is expected if the user was deleted from Clerk.`
      );

      consoleWarnSpy.mockRestore();
    });

    it('should throw error when clerkClient() fails', async () => {
      const customerData: CustomerData = {
        userId: 'user_123',
        customerId: 'cus_123',
        status: 'active',
        paymentStatus: 'paid',
        product: 'pro',
        plan: 'monthly',
        billingCycle: 'monthly',
        lastPayment: new Date('2024-01-01'),
      };

      const error = new Error('Clerk client initialization failed');
      (clerkClient as jest.Mock).mockRejectedValueOnce(error);

      await expect(updateClerkMetadata(customerData)).rejects.toThrow(
        'Clerk client initialization failed'
      );
    });
  });

  describe('Logging', () => {
    it('should log success message', async () => {
      const customerData: CustomerData = {
        userId: 'user_123',
        customerId: 'cus_123',
        status: 'active',
        paymentStatus: 'paid',
        product: 'pro',
        plan: 'monthly',
        billingCycle: 'monthly',
        lastPayment: new Date('2024-01-01'),
      };

      mockUpdateUserMetadata.mockResolvedValueOnce(undefined);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await updateClerkMetadata(customerData);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Updated Clerk metadata for user user_123'
      );

      consoleLogSpy.mockRestore();
    });
  });
});
