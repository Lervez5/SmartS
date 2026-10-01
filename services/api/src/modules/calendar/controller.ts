import { Request, Response } from 'express';
import { createEventSchema, updateEventSchema, listEventsSchema } from './schema';
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getToday,
  getTimedSessions,
} from './service';

export async function listEventsController(req: Request, res: Response): Promise<void> {
  const query = listEventsSchema.parse(req.query);
  const events = await getEvents(req.user!.id, req.user!.role, query);
  res.json(events);
}

export async function todayEventsController(req: Request, res: Response): Promise<void> {
  const events = await getToday(req.user!.id, req.user!.role);
  res.json(events);
}

export async function sessionsController(req: Request, res: Response): Promise<void> {
  const end = req.query.end ? new Date(String(req.query.end)) : new Date();
  const start = req.query.start ? new Date(String(req.query.start)) : new Date(0);
  const events = await getTimedSessions(req.user!.id, start, end);
  res.json(events);
}

export async function createEventController(req: Request, res: Response): Promise<void> {
  const dto = createEventSchema.parse(req.body);
  const event = await createEvent(req.user!.id, dto);
  res.status(201).json(event);
}

export async function updateEventController(req: Request, res: Response): Promise<void> {
  const dto = updateEventSchema.parse(req.body);
  const event = await updateEvent(req.user!.id, req.params.id, dto);
  res.json(event);
}

export async function deleteEventController(req: Request, res: Response): Promise<void> {
  await deleteEvent(req.user!.id, req.params.id);
  res.json({ message: 'Event deleted' });
}
