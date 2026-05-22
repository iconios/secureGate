import express from 'express';
import CreateManagerController from './create.manager.controller';
import VerifyManagerController from './verify.manager.controller';
import LoginManagerController from './login.manager.controller';
import ResendVerificationCodeManagerController from './resend.verification_code.manager.controller';
import ForgotPasswordManagerController from './forgot_password.manager.controller';
import ValidatePasswordResetTokenManagerController from './validate.password_reset_token.controller';
import UpdatePasswordManagerController from './update.password.manager.controller';

const ManagerRouter = express.Router();

ManagerRouter.post('/create', CreateManagerController);
ManagerRouter.post('/verify', VerifyManagerController);
ManagerRouter.post('/login', LoginManagerController);
ManagerRouter.post('/resend-verification-code', ResendVerificationCodeManagerController);
ManagerRouter.post('/forgot-password', ForgotPasswordManagerController);
ManagerRouter.post('validate-password-token', ValidatePasswordResetTokenManagerController);
ManagerRouter.post('/password-update', UpdatePasswordManagerController);
ManagerRouter.post('resend-verification-code', ResendVerificationCodeManagerController);

export default ManagerRouter;
