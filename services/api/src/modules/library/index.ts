import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';

/** Library catalogue, backed by LibraryBook. */

const listSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  availableOnly: z.coerce.boolean().optional(),
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().max(160).optional(),
  isbn: z.string().max(32).optional(),
  category: z.string().max(80).optional(),
  copiesTotal: z.coerce.number().int().min(1).default(1),
});

export const router: Router = Router();

router.get(
  '/',
  requirePermissions('library.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);

    const books = await prisma.libraryBook.findMany({
      where: {
        ...(query.category ? { category: query.category } : {}),
        ...(query.availableOnly ? { copiesAvailable: { gt: 0 } } : {}),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                { author: { contains: query.search, mode: 'insensitive' } },
                { isbn: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { borrowings: true } } },
      orderBy: { title: 'asc' },
    });

    res.json({ books });
  })
);

router.post(
  '/',
  requirePermissions('library.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createSchema.parse(req.body);

    if (payload.isbn) {
      const clash = await prisma.libraryBook.findUnique({
        where: { isbn: payload.isbn },
      });
      if (clash) throw new ApiError(409, 'A book with that ISBN already exists');
    }

    const book = await prisma.libraryBook.create({
      data: {
        title: payload.title,
        author: payload.author,
        isbn: payload.isbn,
        category: payload.category,
        copiesTotal: payload.copiesTotal,
        copiesAvailable: payload.copiesTotal,
      },
    });

    res.status(201).json(book);
  })
);

router.put(
  '/:id',
  requirePermissions('library.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const copies = z.object({ copiesTotal: z.coerce.number().int().min(0) }).parse(req.body);

    const existing = await prisma.libraryBook.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw new ApiError(404, 'Book not found');

    // Availability can never exceed the number of copies owned.
    const borrowed = existing.copiesTotal - existing.copiesAvailable;
    const total = Math.max(copies.copiesTotal, borrowed);

    const book = await prisma.libraryBook.update({
      where: { id: req.params.id },
      data: { copiesTotal: total, copiesAvailable: total - borrowed },
    });
    res.json(book);
  })
);
