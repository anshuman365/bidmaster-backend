
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

const router = Router();

router.post('/register', asyncHandler(AuthController.register));
router.post('/login', asyncHandler(AuthController.login));
router.get('/me', protect, asyncHandler(AuthController.getProfile));
router.put('/profile', protect, asyncHandler(AuthController.updateProfile));

export default router;
