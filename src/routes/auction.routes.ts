import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { AuctionController } from '../controllers/auction.controller';
import { BidController } from '../controllers/bid.controller';
import { protect, authorize, isOwner } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { bidLimiter } from '../middleware/rateLimiter.middleware';
import upload from '../middleware/upload.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auctions
 *   description: Auction management endpoints
 */

/**
 * @swagger
 * /api/v1/auctions:
 *   get:
 *     summary: Get all auctions with filters
 *     tags: [Auctions]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [machinery, vehicles, property, goods, services, all]
 *         description: Filter by category
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, scheduled, live, paused, ended, cancelled, sold, all]
 *         description: Filter by status
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Minimum current bid price
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Maximum current bid price
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *       - in: query
 *         name: companyId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by company ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Page offset
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, currentHighestBid, totalBids, totalViews, endingSoon]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of auctions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     auctions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Auction'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/', 
  [
    query('category')
      .optional()
      .isIn(['machinery', 'vehicles', 'property', 'goods', 'services', 'all'])
      .withMessage('Invalid category'),
    
    query('status')
      .optional()
      .isIn(['draft', 'scheduled', 'live', 'paused', 'ended', 'cancelled', 'sold', 'all'])
      .withMessage('Invalid status'),
    
    query('minPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum price must be a positive number'),
    
    query('maxPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum price must be a positive number'),
    
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search term cannot exceed 100 characters'),
    
    query('companyId')
      .optional()
      .isUUID()
      .withMessage('Invalid company ID format'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
    
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'currentHighestBid', 'totalBids', 'totalViews', 'endingSoon'])
      .withMessage('Invalid sort field'),
    
    query('sortOrder')
      .optional()
      .isIn(['ASC', 'DESC'])
      .withMessage('Sort order must be ASC or DESC')
  ],
  asyncHandler(AuctionController.getAuctions)
);

/**
 * @swagger
 * /api/v1/auctions/{id}:
 *   get:
 *     summary: Get auction by ID
 *     tags: [Auctions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Auction ID
 *     responses:
 *       200:
 *         description: Auction details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Auction'
 *       404:
 *         description: Auction not found
 */
router.get('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid auction ID format')
  ],
  asyncHandler(AuctionController.getAuction)
);

/**
 * @swagger
 * /api/v1/auctions:
 *   post:
 *     summary: Create a new auction
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - category
 *               - subcategory
 *             properties:
 *               title:
 *                 type: string
 *                 example: Industrial Generator 5000W
 *               description:
 *                 type: string
 *                 example: Brand new industrial generator with warranty
 *               category:
 *                 type: string
 *                 enum: [machinery, vehicles, property, goods, services]
 *                 example: machinery
 *               subcategory:
 *                 type: string
 *                 example: generators
 *               itemDetails:
 *                 type: object
 *                 properties:
 *                   condition:
 *                     type: string
 *                     enum: [new, used, refurbished]
 *                   manufacturer:
 *                     type: string
 *                   model:
 *                     type: string
 *                   year:
 *                     type: integer
 *                   specifications:
 *                     type: object
 *               auctionConfig:
 *                 type: object
 *                 properties:
 *                   startingBid:
 *                     type: number
 *                     minimum: 0
 *                   reservePrice:
 *                     type: number
 *                   bidIncrement:
 *                     type: number
 *                     minimum: 0
 *                   buyNowPrice:
 *                     type: number
 *               timing:
 *                 type: object
 *                 properties:
 *                   biddingStartsAt:
 *                     type: string
 *                     format: date-time
 *                   biddingEndsAt:
 *                     type: string
 *                     format: date-time
 *               terms:
 *                 type: object
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Auction created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (requires company or admin role)
 */
router.post('/',
  protect,
  authorize('company', 'admin'),
  upload.array('images', 10), // Maximum 10 images
  [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 10, max: 200 })
      .withMessage('Title must be between 10 and 200 characters'),
    
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ min: 50, max: 5000 })
      .withMessage('Description must be between 50 and 5000 characters'),
    
    body('category')
      .isIn(['machinery', 'vehicles', 'property', 'goods', 'services'])
      .withMessage('Invalid category'),
    
    body('subcategory')
      .trim()
      .notEmpty()
      .withMessage('Subcategory is required')
      .isLength({ max: 100 })
      .withMessage('Subcategory cannot exceed 100 characters'),
    
    body('itemDetails')
      .optional()
      .isObject()
      .withMessage('Item details must be an object'),
    
    body('auctionConfig')
      .optional()
      .isObject()
      .withMessage('Auction config must be an object'),
    
    body('auctionConfig.startingBid')
      .if(body('auctionConfig').exists())
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Starting bid must be a positive number'),
    
    body('auctionConfig.reservePrice')
      .if(body('auctionConfig').exists())
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Reserve price must be a positive number'),
    
    body('auctionConfig.bidIncrement')
      .if(body('auctionConfig').exists())
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Bid increment must be a positive number'),
    
    body('timing')
      .optional()
      .isObject()
      .withMessage('Timing must be an object'),
    
    body('timing.biddingStartsAt')
      .if(body('timing').exists())
      .optional()
      .isISO8601()
      .withMessage('Invalid start date format'),
    
    body('timing.biddingEndsAt')
      .if(body('timing').exists())
      .optional()
      .isISO8601()
      .withMessage('Invalid end date format')
      .custom((value, { req }) => {
        if (req.body.timing?.biddingStartsAt && new Date(value) <= new Date(req.body.timing.biddingStartsAt)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    
    body('terms')
      .optional()
      .isObject()
      .withMessage('Terms must be an object'),
    
    body('companyId')
      .optional()
      .isUUID()
      .withMessage('Invalid company ID format')
      .custom((value, { req }) => {
        if (req.user?.role === 'company' && value !== req.user.companyId) {
          throw new Error('Cannot create auction for another company');
        }
        return true;
      })
  ],
  asyncHandler(AuctionController.createAuction)
);

/**
 * @swagger
 * /api/v1/auctions/{id}:
 *   put:
 *     summary: Update auction
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, scheduled, live, paused, ended, cancelled, sold]
 *               itemDetails:
 *                 type: object
 *               auctionConfig:
 *                 type: object
 *               timing:
 *                 type: object
 *               terms:
 *                 type: object
 *     responses:
 *       200:
 *         description: Auction updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (owner or admin only)
 *       404:
 *         description: Auction not found
 */
router.put('/:id',
  protect,
  authorize('company', 'admin'),
  isOwner('companyId'),
  [
    param('id')
      .isUUID()
      .withMessage('Invalid auction ID format'),
    
    body('title')
      .optional()
      .trim()
      .isLength({ min: 10, max: 200 })
      .withMessage('Title must be between 10 and 200 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ min: 50, max: 5000 })
      .withMessage('Description must be between 50 and 5000 characters'),
    
    body('status')
      .optional()
      .isIn(['draft', 'scheduled', 'live', 'paused', 'ended', 'cancelled', 'sold'])
      .withMessage('Invalid status'),
    
    body('itemDetails')
      .optional()
      .isObject()
      .withMessage('Item details must be an object'),
    
    body('auctionConfig')
      .optional()
      .isObject()
      .withMessage('Auction config must be an object'),
    
    body('timing')
      .optional()
      .isObject()
      .withMessage('Timing must be an object'),
    
    body('terms')
      .optional()
      .isObject()
      .withMessage('Terms must be an object')
  ],
  asyncHandler(AuctionController.updateAuction)
);

/**
 * @swagger
 * /api/v1/auctions/{id}:
 *   delete:
 *     summary: Delete auction
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Auction deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (admin only)
 *       404:
 *         description: Auction not found
 */
router.delete('/:id',
  protect,
  authorize('admin'),
  [
    param('id')
      .isUUID()
      .withMessage('Invalid auction ID format')
  ],
  asyncHandler(AuctionController.deleteAuction)
);

/**
 * @swagger
 * /api/v1/auctions/{id}/start:
 *   post:
 *     summary: Start auction
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Auction started successfully
 *       400:
 *         description: Cannot start auction (invalid status or timing)
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (owner or admin only)
 *       404:
 *         description: Auction not found
 */
router.post('/:id/start',
  protect,
  authorize('company', 'admin'),
  isOwner('companyId'),
  [
    param('id')
      .isUUID()
      .withMessage('Invalid auction ID format')
  ],
  asyncHandler(AuctionController.startAuction)
);

/**
 * @swagger
 * /api/v1/auctions/{id}/bid:
 *   post:
 *     summary: Place a bid on auction
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 example: 15000
 *     responses:
 *       200:
 *         description: Bid placed successfully
 *       400:
 *         description: Invalid bid amount or auction not live
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (bidder role required)
 *       404:
 *         description: Auction not found
 */
router.post('/:id/bid',
  protect,
  authorize('bidder'),
  bidLimiter,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid auction ID format'),
    
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Bid amount must be a positive number')
  ],
  asyncHandler(AuctionController.placeBid)
);

/**
 * @swagger
 * /api/v1/auctions/{id}/bids:
 *   get:
 *     summary: Get all bids for an auction
 *     tags: [Auctions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: List of bids
 *       404:
 *         description: Auction not found
 */
router.get('/:id/bids',
  [
    param('id')
      .isUUID()
      .withMessage('Invalid auction ID format'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
  ],
  asyncHandler(AuctionController.getAuctionBids)
);

/**
 * @swagger
 * /api/v1/auctions/{id}/status:
 *   put:
 *     summary: Update auction status
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, scheduled, live, paused, ended, cancelled, sold]
 *     responses:
 *       200:
 *         description: Auction status updated
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Auction not found
 */
router.put('/:id/status',
  protect,
  authorize('company', 'admin'),
  isOwner('companyId'),
  [
    param('id')
      .isUUID()
      .withMessage('Invalid auction ID format'),
    
    body('status')
      .isIn(['draft', 'scheduled', 'live', 'paused', 'ended', 'cancelled', 'sold'])
      .withMessage('Invalid status')
  ],
  asyncHandler(AuctionController.updateAuctionStatus)
);

/**
 * @swagger
 * /api/v1/auctions/{id}/watch:
 *   post:
 *     summary: Watch/unwatch auction
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - watch
 *             properties:
 *               watch:
 *                 type: boolean
 *                 description: true to watch, false to unwatch
 *     responses:
 *       200:
 *         description: Watch status updated
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Auction not found
 */
router.post('/:id/watch',
  protect,
  [
    param('id')
      .isUUID()
      .withMessage('Invalid auction ID format'),
    
    body('watch')
      .isBoolean()
      .withMessage('Watch must be a boolean')
  ],
  asyncHandler(AuctionController.toggleWatch)
);

/**
 * @swagger
 * /api/v1/auctions/live:
 *   get:
 *     summary: Get live auctions
 *     tags: [Auctions]
 *     responses:
 *       200:
 *         description: List of live auctions
 */
router.get('/category/live',
  asyncHandler(AuctionController.getLiveAuctions)
);

/**
 * @swagger
 * /api/v1/auctions/company/{companyId}:
 *   get:
 *     summary: Get auctions by company
 *     tags: [Auctions]
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, scheduled, live, paused, ended, cancelled, sold, all]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: Company auctions
 *       404:
 *         description: Company not found
 */
router.get('/company/:companyId',
  [
    param('companyId')
      .isUUID()
      .withMessage('Invalid company ID format'),
    
    query('status')
      .optional()
      .isIn(['draft', 'scheduled', 'live', 'paused', 'ended', 'cancelled', 'sold', 'all'])
      .withMessage('Invalid status'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
  ],
  asyncHandler(AuctionController.getCompanyAuctions)
);

/**
 * @swagger
 * /api/v1/auctions/user/my-auctions:
 *   get:
 *     summary: Get current user's auctions
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, scheduled, live, paused, ended, cancelled, sold, all]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: User's auctions
 *       401:
 *         description: Not authenticated
 */
router.get('/user/my-auctions',
  protect,
  authorize('company', 'admin'),
  [
    query('status')
      .optional()
      .isIn(['draft', 'scheduled', 'live', 'paused', 'ended', 'cancelled', 'sold', 'all'])
      .withMessage('Invalid status'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
  ],
  asyncHandler(AuctionController.getCompanyAuctions)
);

/**
 * @swagger
 * /api/v1/auctions/{id}/images:
 *   post:
 *     summary: Upload images for auction
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *       400:
 *         description: No images provided
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Auction not found
 */
router.post('/:id/images',
  protect,
  authorize('company', 'admin'),
  isOwner('companyId'),
  upload.array('images', 10),
  [
    param('id')
      .isUUID()
      .withMessage('Invalid auction ID format')
  ],
  asyncHandler(AuctionController.uploadImages)
);

/**
 * @swagger
 * /api/v1/auctions/{id}/images/{imageId}:
 *   delete:
 *     summary: Delete auction image
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Auction or image not found
 */
router.delete('/:id/images/:imageId',
  protect,
  authorize('company', 'admin'),
  isOwner('companyId'),
  [
    param('id').isUUID().withMessage('Invalid auction ID format'),
    param('imageId').isString().notEmpty().withMessage('Image ID is required')
  ],
  asyncHandler(AuctionController.deleteImage)
);

export default router;