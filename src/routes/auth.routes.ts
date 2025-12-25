import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/auth.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { authLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization
 */

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - phone
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: password123
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               phone:
 *                 type: string
 *                 example: +1234567890
 *               role:
 *                 type: string
 *                 enum: [admin, company, bidder]
 *                 example: bidder
 *               companyDetails:
 *                 type: object
 *                 description: Required if role is 'company'
 *                 properties:
 *                   companyName:
 *                     type: string
 *                   registrationNumber:
 *                     type: string
 *                   taxId:
 *                     type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/register', 
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/\d/)
      .withMessage('Password must contain at least one number')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter'),
    
    body('firstName')
      .trim()
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ max: 50 })
      .withMessage('First name cannot exceed 50 characters'),
    
    body('lastName')
      .trim()
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ max: 50 })
      .withMessage('Last name cannot exceed 50 characters'),
    
    body('phone')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required')
      .isMobilePhone('any')
      .withMessage('Please provide a valid phone number'),
    
    body('role')
      .isIn(['admin', 'company', 'bidder'])
      .withMessage('Role must be one of: admin, company, bidder'),
    
    body('companyDetails')
      .optional()
      .custom((value, { req }) => {
        if (req.body.role === 'company' && !value) {
          throw new Error('Company details are required for company registration');
        }
        return true;
      }),
    
    body('companyDetails.companyName')
      .if(body('role').equals('company'))
      .trim()
      .notEmpty()
      .withMessage('Company name is required'),
    
    body('companyDetails.registrationNumber')
      .if(body('role').equals('company'))
      .trim()
      .notEmpty()
      .withMessage('Company registration number is required'),
    
    body('companyDetails.taxId')
      .if(body('role').equals('company'))
      .trim()
      .notEmpty()
      .withMessage('Tax ID is required')
  ],
  asyncHandler(AuthController.register)
);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *               deviceInfo:
 *                 type: object
 *                 properties:
 *                   deviceId:
 *                     type: string
 *                   deviceName:
 *                     type: string
 *                   platform:
 *                     type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       423:
 *         description: Account locked
 */
router.post('/login',
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    
    body('deviceInfo')
      .optional()
      .isObject()
  ],
  asyncHandler(AuthController.login)
);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get('/me', 
  protect,
  asyncHandler(AuthController.getProfile)
);

/**
 * @swagger
 * /api/v1/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               phone:
 *                 type: string
 *                 example: +1234567890
 *               profilePicture:
 *                 type: string
 *                 format: uri
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   zipcode:
 *                     type: string
 *                   country:
 *                     type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.put('/profile',
  protect,
  [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    
    body('phone')
      .optional()
      .trim()
      .isMobilePhone('any')
      .withMessage('Please provide a valid phone number'),
    
    body('profilePicture')
      .optional()
      .isURL()
      .withMessage('Please provide a valid URL for profile picture'),
    
    body('address')
      .optional()
      .isObject()
      .withMessage('Address must be an object'),
    
    body('address.street')
      .if(body('address').exists())
      .trim()
      .notEmpty()
      .withMessage('Street address is required'),
    
    body('address.city')
      .if(body('address').exists())
      .trim()
      .notEmpty()
      .withMessage('City is required'),
    
    body('address.state')
      .if(body('address').exists())
      .trim()
      .notEmpty()
      .withMessage('State is required'),
    
    body('address.zipcode')
      .if(body('address').exists())
      .trim()
      .notEmpty()
      .withMessage('Zipcode is required'),
    
    body('address.country')
      .if(body('address').exists())
      .trim()
      .notEmpty()
      .withMessage('Country is required')
  ],
  asyncHandler(AuthController.updateProfile)
);

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh-token',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
  ],
  asyncHandler(AuthController.refreshToken)
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Not authenticated
 */
router.post('/logout',
  protect,
  asyncHandler(AuthController.logout)
);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: User not found
 */
router.post('/forgot-password',
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address')
  ],
  asyncHandler(AuthController.forgotPassword)
);

/**
 * @swagger
 * /api/v1/auth/reset-password/{token}:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password/:token',
  [
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/\d/)
      .withMessage('Password must contain at least one number')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
  ],
  asyncHandler(AuthController.resetPassword)
);

/**
 * @swagger
 * /api/v1/auth/verify-email/{token}:
 *   get:
 *     summary: Verify email address
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.get('/verify-email/:token',
  asyncHandler(AuthController.verifyEmail)
);

/**
 * @swagger
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 *       401:
 *         description: Not authenticated
 *       400:
 *         description: Email already verified
 */
router.post('/resend-verification',
  protect,
  asyncHandler(AuthController.resendVerificationEmail)
);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 example: oldpassword123
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Current password is incorrect
 */
router.post('/change-password',
  protect,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long')
      .matches(/\d/)
      .withMessage('New password must contain at least one number')
      .matches(/[A-Z]/)
      .withMessage('New password must contain at least one uppercase letter')
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error('New password must be different from current password');
        }
        return true;
      })
  ],
  asyncHandler(AuthController.changePassword)
);

/**
 * @swagger
 * /api/v1/auth/2fa/enable:
 *   post:
 *     summary: Enable two-factor authentication
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA enabled successfully
 *       401:
 *         description: Not authenticated
 */
router.post('/2fa/enable',
  protect,
  asyncHandler(AuthController.enable2FA)
);

/**
 * @swagger
 * /api/v1/auth/2fa/disable:
 *   post:
 *     summary: Disable two-factor authentication
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: 2FA verification code
 *     responses:
 *       200:
 *         description: 2FA disabled successfully
 *       401:
 *         description: Not authenticated or invalid code
 */
router.post('/2fa/disable',
  protect,
  [
    body('code')
      .notEmpty()
      .withMessage('Verification code is required')
      .isLength({ min: 6, max: 6 })
      .withMessage('Code must be 6 digits')
  ],
  asyncHandler(AuthController.disable2FA)
);

/**
 * @swagger
 * /api/v1/auth/2fa/verify:
 *   post:
 *     summary: Verify two-factor authentication code
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               code:
 *                 type: string
 *                 description: 2FA verification code
 *     responses:
 *       200:
 *         description: 2FA verified successfully
 *       401:
 *         description: Invalid credentials or code
 */
router.post('/2fa/verify',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    
    body('code')
      .notEmpty()
      .withMessage('Verification code is required')
      .isLength({ min: 6, max: 6 })
      .withMessage('Code must be 6 digits')
  ],
  asyncHandler(AuthController.verify2FA)
);

// Admin-only routes
router.get('/admin/users',
  protect,
  authorize('admin'),
  asyncHandler(AuthController.getAllUsers)
);

router.get('/admin/users/:userId',
  protect,
  authorize('admin'),
  asyncHandler(AuthController.getUserById)
);

router.put('/admin/users/:userId/status',
  protect,
  authorize('admin'),
  [
    body('status')
      .isIn(['active', 'suspended', 'banned'])
      .withMessage('Status must be active, suspended, or banned'),
    
    body('reason')
      .optional()
      .isString()
      .withMessage('Reason must be a string')
  ],
  asyncHandler(AuthController.updateUserStatus)
);

export default router;