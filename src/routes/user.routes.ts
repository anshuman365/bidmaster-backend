import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { AuthController } from '../controllers/auth.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { body } from 'express-validator';
import multer from 'multer';

const router = Router();

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// All routes require authentication
router.use(protect);

// Get user profile
router.get('/profile', asyncHandler(UserController.getProfile));

// Update user profile
router.put('/profile', [
  body('firstName').optional().isString().trim(),
  body('lastName').optional().isString().trim(),
  body('phone').optional().isMobilePhone('any'),
  body('address').optional().isObject()
], asyncHandler(UserController.updateProfile));

// Change password
router.post('/change-password', [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 6 })
], asyncHandler(UserController.changePassword));

// Upload profile picture
router.post('/profile-picture', 
  upload.single('profilePicture'),
  asyncHandler(UserController.uploadProfilePicture)
);

// Get user stats
router.get('/stats', asyncHandler(UserController.getUserStats));

// Notification routes
router.get('/notifications', asyncHandler(UserController.getNotifications));
router.patch('/notifications/:notificationId/read', asyncHandler(UserController.markNotificationRead));

// Settings routes
router.get('/settings', asyncHandler(UserController.getProfile)); // Returns settings in user object
router.put('/settings', asyncHandler(UserController.updateSettings));

// Activity log
router.get('/activity', asyncHandler(UserController.getActivityLog));

// Address management
router.get('/addresses', asyncHandler(UserController.getAddresses));
router.put('/address', [
  body('street').isString().notEmpty(),
  body('city').isString().notEmpty(),
  body('state').isString().notEmpty(),
  body('zipcode').isString().notEmpty(),
  body('country').isString().notEmpty()
], asyncHandler(UserController.updateAddress));

// Email verification
router.get('/verify-email/:token', asyncHandler(UserController.verifyEmail));
router.post('/resend-verification', asyncHandler(UserController.resendVerificationEmail));

// Account management
router.post('/request-deletion', asyncHandler(UserController.requestAccountDeletion));

// Refresh token
router.post('/refresh-token', asyncHandler(AuthController.refreshToken));

// Logout
router.post('/logout', asyncHandler(AuthController.logout));

// Admin only routes
router.get('/all', authorize('admin'), asyncHandler(UserController.getNotifications)); // Placeholder

export default router;