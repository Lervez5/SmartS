import { Router } from 'express';
import {
  listEventsController,
  todayEventsController,
  sessionsController,
  createEventController,
  updateEventController,
  deleteEventController,
} from './controller';
import { requireRole, requirePermissions } from '../../middleware/rbac';

export const router: Router = Router();

const requireCalendarManage = requirePermissions('calendar.manage');

router.get('/events', (req, res, next) => {
  listEventsController(req, res).catch(next);
});

router.get('/today', (req, res, next) => {
  todayEventsController(req, res).catch(next);
});

router.get('/sessions', requireCalendarManage, (req, res, next) => {
  sessionsController(req, res).catch(next);
});

router.post('/events', (req, res, next) => {
  createEventController(req, res).catch(next);
});

router.put('/events/:id', (req, res, next) => {
  updateEventController(req, res).catch(next);
});

router.delete('/events/:id', (req, res, next) => {
  deleteEventController(req, res).catch(next);
});
