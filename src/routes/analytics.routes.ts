import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

const router = Router();

// All analytics routes require authentication
router.use(protect);

// Platform analytics (admin only)
router.get('/platform/overview', authorize('admin'), asyncHandler(AnalyticsController.getPlatformOverview));
router.get('/platform/revenue', authorize('admin'), asyncHandler(AnalyticsController.getPlatformRevenue));
router.get('/platform/users', authorize('admin'), asyncHandler(AnalyticsController.getUserAnalytics));
router.get('/platform/auctions', authorize('admin'), asyncHandler(AnalyticsController.getAuctionAnalytics));

// Company analytics (company and admin)
router.get('/company/overview', authorize('company', 'admin'), asyncHandler(AnalyticsController.getCompanyOverview));
router.get('/company/auctions', authorize('company', 'admin'), asyncHandler(AnalyticsController.getCompanyAuctionsAnalytics));
router.get('/company/revenue', authorize('company', 'admin'), asyncHandler(AnalyticsController.getCompanyRevenue));

// User analytics (all authenticated users)
router.get('/user/overview', asyncHandler(AnalyticsController.getUserOverview));
router.get('/user/bidding', asyncHandler(AnalyticsController.getUserBiddingAnalytics));
router.get('/user/spending', asyncHandler(AnalyticsController.getUserSpendingAnalytics));

// Real-time analytics
router.get('/realtime/active-users', authorize('admin'), asyncHandler(AnalyticsController.getActiveUsers));
router.get('/realtime/live-auctions', asyncHandler(AnalyticsController.getLiveAuctionsStats));
router.get('/realtime/bid-activity', asyncHandler(AnalyticsController.getBidActivity));

// Category analytics
router.get('/categories', asyncHandler(AnalyticsController.getCategoryAnalytics));
router.get('/categories/:categoryId', asyncHandler(AnalyticsController.getCategoryDetails));

// Time-based analytics
router.get('/time/daily', authorize('admin'), asyncHandler(AnalyticsController.getDailyStats));
router.get('/time/weekly', authorize('admin'), asyncHandler(AnalyticsController.getWeeklyStats));
router.get('/time/monthly', authorize('admin'), asyncHandler(AnalyticsController.getMonthlyStats));

// Geographic analytics
router.get('/geographic/users', authorize('admin'), asyncHandler(AnalyticsController.getUserGeographicData));
router.get('/geographic/auctions', asyncHandler(AnalyticsController.getAuctionGeographicData));

// Performance metrics
router.get('/performance/load-times', authorize('admin'), asyncHandler(AnalyticsController.getLoadTimes));
router.get('/performance/conversion', authorize('admin'), asyncHandler(AnalyticsController.getConversionRates));
router.get('/performance/retention', authorize('admin'), asyncHandler(AnalyticsController.getUserRetention));

// Export analytics data
router.post('/export', [
  authorize('admin', 'company'),
  body('type').isIn(['csv', 'json', 'pdf']),
  body('dataType').isIn(['users', 'auctions', 'revenue', 'bids']),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601()
], asyncHandler(AnalyticsController.exportAnalyticsData));

// Predictive analytics
router.get('/predictive/revenue-forecast', authorize('admin'), asyncHandler(AnalyticsController.getRevenueForecast));
router.get('/predictive/user-growth', authorize('admin'), asyncHandler(AnalyticsController.getUserGrowthPrediction));
router.get('/predictive/auction-trends', asyncHandler(AnalyticsController.getAuctionTrends));

// Custom reports
router.post('/custom-report', [
  authorize('admin', 'company'),
  body('metrics').isArray(),
  body('dimensions').optional().isArray(),
  body('filters').optional().isObject(),
  body('timeRange').optional().isObject()
], asyncHandler(AnalyticsController.generateCustomReport));

// Dashboard widgets data
router.get('/dashboard-widgets', asyncHandler(AnalyticsController.getDashboardWidgets));

export default router;