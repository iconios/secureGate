import express from 'express';
import CreateManagerController from './create.manager.controller';
import VerifyManagerController from './verify.manager.controller';
import LoginManagerController from './login.manager.controller';
import ResendVerificationCodeManagerController from './resend.verification_code.manager.controller';
import ForgotPasswordManagerController from './forgot_password.manager.controller';

const ManagerRouter = express.Router();

ManagerRouter.post('/create', CreateManagerController);
ManagerRouter.post('/verify', VerifyManagerController);
ManagerRouter.post('/login', LoginManagerController);
ManagerRouter.post('/resend-verification-code', ResendVerificationCodeManagerController);
ManagerRouter.post('/forgot-password', ForgotPasswordManagerController);

export default ManagerRouter;
