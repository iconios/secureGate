import express from 'express';
import CreateManagerController from './create.manager.controller.js';
import VerifyManagerController from './verify.manager.controller.js';
import LoginManagerController from './login.manager.controller.js';
import ResendVerificationCodeManagerController from './resend.verification_code.manager.controller.js';
import ForgotPasswordManagerController from './forgot_password.manager.controller.js';
import ValidatePasswordResetTokenManagerController from './validate.password_reset_token.controller.js';
import UpdatePasswordManagerController from './update.password.manager.controller.js';
import FetchManagerInfoController from './fetch.manager.info.controller.js';
import extractToken from '../../middleware/extractToken.js';

const ManagerRouter = express.Router();

ManagerRouter.post('/create', CreateManagerController);
ManagerRouter.post('/verify', VerifyManagerController);
ManagerRouter.post('/login', LoginManagerController);
ManagerRouter.post('/resend-verification-code', ResendVerificationCodeManagerController);
ManagerRouter.post('/forgot-password', ForgotPasswordManagerController);
ManagerRouter.post('validate-password-token', ValidatePasswordResetTokenManagerController);
ManagerRouter.post('/password-update', UpdatePasswordManagerController);
ManagerRouter.post('resend-verification-code', ResendVerificationCodeManagerController);
ManagerRouter.post('/info', extractToken, FetchManagerInfoController);

export default ManagerRouter;
