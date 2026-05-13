import express from 'express';
import CreateManagerController from './create.manager.controller';
import VerifyManagerController from './verify.manager.controller';
import LoginManagerController from './login.manager.controller';

const ManagerRouter = express.Router();

ManagerRouter.post('/create', CreateManagerController);
ManagerRouter.post('/verify', VerifyManagerController);
ManagerRouter.post('/login', LoginManagerController);

export default ManagerRouter;
