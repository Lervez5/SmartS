import { Router } from 'express';
import {
  createUserController,
  deleteUserController,
  listUsersController,
  requireUserManage,
  requireUserView,
  requireUserCreate,
  requireUserImport,
  updateUserController,
  updateMeController,
  updateMyPasswordController,
  bulkImportUsersController,
} from './controller';

export const router: Router = Router();

router.post('/bulk', requireUserImport, (req, res, next) => {
  bulkImportUsersController(req, res).catch(next);
});

router.get('/', requireUserView, (req, res, next) => {
  listUsersController(req, res).catch(next);
});

router.post('/', requireUserCreate, (req, res, next) => {
  createUserController(req, res).catch(next);
});

router.put('/me', (req, res, next) => {
  updateMeController(req, res).catch(next);
});

router.put('/me/password', (req, res, next) => {
  updateMyPasswordController(req, res).catch(next);
});

router.put('/:id', requireUserManage, (req, res, next) => {
  updateUserController(req, res).catch(next);
});

router.delete('/:id', requireUserManage, (req, res, next) => {
  deleteUserController(req, res).catch(next);
});
