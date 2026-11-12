/**
 * @file SPA authentication routes (sign-in, reset-password, current user lookup).
 * PCI DSS 4.0: Req 8.2.1 / 8.3.2 (authentication), Req 8.3.4 (password reset), Req 10.2.1 (audit logging).
 */
const express = require('express');
const router = express.Router();
const authCtrl = require('../../../controllers/SPA/Auth/auth.controller');
const { verifyToken } = require('../../../middlewares/jtwAuth.middleware');

/** Authenticates a user and returns a token. */
router.post('/', authCtrl.signIn);
/** Authenticates a user and returns a token. */
router.post('/login', authCtrl.signIn);
/** Initiates a password reset. */
router.post('/reset-password', authCtrl.resetPassword);
/** Processes a password reset confirmation. */
router.post('/reset-password-process', authCtrl.resetPasswordProcess);
/** Returns current user data; requires JWT token validation. */
router.get('/me', verifyToken, authCtrl.me);
module.exports = router;