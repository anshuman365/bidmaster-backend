import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { body } from 'express-validator';

const router = Router();

// All admin routes require admin authorization
router.use(protect, authorize('admin'));

// Dashboard statistics
router.get('/dashboard/stats', asyncHandler(AdminController.getDashboardStats));

// User management
router.get('/users', asyncHandler(AdminController.getUsers));
router.get('/users/:userId', asyncHandler(AdminController.getUserDetails));
router.put('/users/:userId/status', [
  body('status').isIn(['active', 'suspended', 'banned'])
], asyncHandler(AdminController.updateUserStatus));
router.put('/users/:userId/role', [
  body('role').isIn(['admin', 'company', 'bidder'])
], asyncHandler(AdminController.updateUserRole));

// Auction management
router.get('/auctions', asyncHandler(AdminController.getAuctions));
router.get('/auctions/:auctionId', asyncHandler(AdminController.getAuctionDetails));
router.put('/auctions/:auctionId/status', [
  body('status').isIn(['live', 'paused', 'ended', 'cancelled'])
], asyncHandler(AdminController.updateAuctionStatus));
router.delete('/auctions/:auctionId', asyncHandler(AdminController.deleteAuction));

// Company management
router.get('/companies', asyncHandler(AdminController.getCompanies));
router.get('/companies/:companyId', asyncHandler(AdminController.getCompanyDetails));
router.put('/companies/:companyId/verify', asyncHandler(AdminController.verifyCompany));
router.put('/companies/:companyId/kyc-status', [
  body('status').isIn(['pending', 'verified', 'rejected']),
  body('notes').optional().isString()
], asyncHandler(AdminController.updateKYCStatus));

// Payment management
router.get('/payments', asyncHandler(AdminController.getPayments));
router.get('/payments/:paymentId', asyncHandler(AdminController.getPaymentDetails));
router.post('/payments/:paymentId/refund', [
  body('reason').optional().isString(),
  body('amount').optional().isFloat({ min: 0 })
], asyncHandler(AdminController.processRefund));

// Dispute resolution
router.get('/disputes', asyncHandler(AdminController.getDisputes));
router.get('/disputes/:disputeId', asyncHandler(AdminController.getDisputeDetails));
router.put('/disputes/:disputeId/resolve', [
  body('resolution').isString().notEmpty(),
  body('winnerId').optional().isString(),
  body('refundAmount').optional().isFloat({ min: 0 })
], asyncHandler(AdminController.resolveDispute));

// System configuration
router.get('/config', asyncHandler(AdminController.getSystemConfig));
router.put('/config', [
  body('settings').isObject()
], asyncHandler(AdminController.updateSystemConfig));

// Commission management
router.get('/commissions', asyncHandler(AdminController.getCommissions));
router.put('/commissions', [
  body('rate').isFloat({ min: 0, max: 100 }),
  body('minAmount').optional().isFloat({ min: 0 })
], asyncHandler(AdminController.updateCommissionRate));

// Reports
router.get('/reports/sales', asyncHandler(AdminController.getSalesReport));
router.get('/reports/users', asyncHandler(AdminController.getUserReport));
router.get('/reports/auctions', asyncHandler(AdminController.getAuctionReport));
router.post('/reports/generate', [
  body('type').isIn(['sales', 'users', 'auctions', 'payments']),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('format').optional().isIn(['json', 'csv', 'pdf'])
], asyncHandler(AdminController.generateReport));

// Email management
router.post('/email/broadcast', [
  body('subject').isString().notEmpty(),
  body('message').isString().notEmpty(),
  body('recipients').optional().isIn(['all', 'bidders', 'companies', 'admins']),
  body('userIds').optional().isArray()
], asyncHandler(AdminController.sendBroadcastEmail));

// System logs
router.get('/logs', asyncHandler(AdminController.getSystemLogs));
router.get('/logs/error', asyncHandler(AdminController.getErrorLogs));
router.get('/logs/audit', asyncHandler(AdminController.getAuditLogs));

// Backup and restore
router.post('/backup', asyncHandler(AdminController.createBackup));
router.get('/backups', asyncHandler(AdminController.getBackups));
router.post('/restore/:backupId', asyncHandler(AdminController.restoreBackup));

// Featured auctions management
router.get('/featured-auctions', asyncHandler(AdminController.getFeaturedAuctions));
router.post('/featured-auctions/:auctionId', [
  body('featuredUntil').isISO8601(),
  body('priority').optional().isInt({ min: 1, max: 10 })
], asyncHandler(AdminController.featureAuction));
router.delete('/featured-auctions/:auctionId', asyncHandler(AdminController.unfeatureAuction));

// Category management
router.get('/categories', asyncHandler(AdminController.getCategories));
router.post('/categories', [
  body('name').isString().notEmpty(),
  body('description').optional().isString(),
  body('icon').optional().isString(),
  body('parentId').optional().isString()
], asyncHandler(AdminController.createCategory));
router.put('/categories/:categoryId', asyncHandler(AdminController.updateCategory));
router.delete('/categories/:categoryId', asyncHandler(AdminController.deleteCategory));

// Promo codes management
router.get('/promo-codes', asyncHandler(AdminController.getPromoCodes));
router.post('/promo-codes', [
  body('code').isString().notEmpty(),
  body('discountType').isIn(['percentage', 'fixed']),
  body('discountValue').isFloat({ min: 0 }),
  body('maxUses').optional().isInt({ min: 1 }),
  body('validFrom').isISO8601(),
  body('validUntil').isISO8601(),
  body('minPurchase').optional().isFloat({ min: 0 })
], asyncHandler(AdminController.createPromoCode));
router.put('/promo-codes/:promoCodeId', asyncHandler(AdminController.updatePromoCode));
router.delete('/promo-codes/:promoCodeId', asyncHandler(AdminController.deletePromoCode));

// System health check
router.get('/health', asyncHandler(AdminController.getSystemHealth));

// Cache management
router.delete('/cache', asyncHandler(AdminController.clearCache));

export default router;