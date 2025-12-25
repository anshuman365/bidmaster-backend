import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { body } from 'express-validator';

const router = Router();

// All company routes require authentication
router.use(protect);

// Company registration (for users upgrading to company role)
router.post('/register', [
  authorize('bidder'), // Only bidders can upgrade to company
  body('companyName').isString().notEmpty(),
  body('registrationNumber').isString().notEmpty(),
  body('taxId').isString().notEmpty(),
  body('address').isObject(),
  body('contactPerson').isString().notEmpty(),
  body('phone').isMobilePhone('any'),
  body('website').optional().isURL(),
  body('description').optional().isString()
], asyncHandler(CompanyController.registerCompany));

// Get company profile
router.get('/profile', authorize('company', 'admin'), asyncHandler(CompanyController.getCompanyProfile));

// Update company profile
router.put('/profile', [
  authorize('company', 'admin'),
  body('companyName').optional().isString(),
  body('address').optional().isObject(),
  body('contactPerson').optional().isString(),
  body('phone').optional().isMobilePhone('any'),
  body('website').optional().isURL(),
  body('description').optional().isString()
], asyncHandler(CompanyController.updateCompanyProfile));

// Upload company documents
router.post('/documents', [
  authorize('company'),
  body('documentType').isIn(['registration', 'tax', 'license', 'other']),
  body('documentUrl').isString().notEmpty(),
  body('expiryDate').optional().isISO8601()
], asyncHandler(CompanyController.uploadDocument));

// Get company auctions
router.get('/auctions', authorize('company', 'admin'), asyncHandler(CompanyController.getCompanyAuctions));

// Get company stats
router.get('/stats', authorize('company', 'admin'), asyncHandler(CompanyController.getCompanyStats));

// Get company transactions
router.get('/transactions', authorize('company', 'admin'), asyncHandler(CompanyController.getTransactions));

// Get company bidders
router.get('/bidders', authorize('company', 'admin'), asyncHandler(CompanyController.getCompanyBidders));

// Update company settings
router.put('/settings', authorize('company', 'admin'), asyncHandler(CompanyController.updateCompanySettings));

// Submit KYC documents
router.post('/kyc', [
  authorize('company'),
  body('documents').isArray(),
  body('documents.*.type').isString(),
  body('documents.*.url').isString(),
  body('documents.*.verified').optional().isBoolean()
], asyncHandler(CompanyController.submitKYCDocuments));

// Check KYC status
router.get('/kyc/status', authorize('company'), asyncHandler(CompanyController.checkKYCStatus));

// Get company reviews
router.get('/reviews', asyncHandler(CompanyController.getCompanyReviews));

// Submit company review
router.post('/reviews', [
  authorize('bidder'),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString(),
  body('auctionId').optional().isString()
], asyncHandler(CompanyController.submitReview));

// Admin routes for company management
router.get('/admin/all', authorize('admin'), asyncHandler(CompanyController.getAllCompanies));
router.get('/admin/:companyId', authorize('admin'), asyncHandler(CompanyController.getCompanyDetails));
router.put('/admin/:companyId/verify', authorize('admin'), asyncHandler(CompanyController.verifyCompany));
router.put('/admin/:companyId/status', [
  authorize('admin'),
  body('status').isIn(['active', 'suspended', 'pending'])
], asyncHandler(CompanyController.updateCompanyStatus));

export default router;