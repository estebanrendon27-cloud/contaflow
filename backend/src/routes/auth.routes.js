// ─── routes/auth.routes.js ───────────────────────────────────────────────────
import { Router } from 'express';
import { register, login, refreshToken, me, changePassword } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, me);
router.put('/change-password', authenticate, changePassword);
export default router;
