import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { resolveSchoolScope } from '../settings/scope';

/**
 * Finance.
 *
 * School-level financial behaviour (currency, invoice numbering, receipt
 * footer) comes from the Finance settings; the transactions themselves live
 * here. Settings configures behaviour, this module owns the money.
 */

const listInvoicesSchema = z.object({
  status: z.string().optional(),
  studentId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const createInvoiceSchema = z.object({
  studentId: z.string().optional(),
  amountCents: z.coerce.number().int().positive(),
  dueDate: z.string().datetime().or(z.string().min(10)),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1).max(200),
        amountCents: z.coerce.number().int(),
      })
    )
    .optional(),
});

export const router: Router = Router();

/** School financial summary, shaped by the school's own settings. */
router.get(
  '/summary',
  requirePermissions('finance.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const scope = await resolveSchoolScope(req);
    const config = await financeConfigFor(req, scope.schoolId);

    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [invoiced, paid, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: { issuedAt: { gte: from } },
        select: { amountCents: true, status: true },
      }),
      prisma.invoice.findMany({
        where: { status: 'paid', paidAt: { gte: from } },
        select: { amountCents: true },
      }),
      prisma.expense.findMany({
        where: { createdAt: { gte: from } },
        select: { amountCents: true },
      }),
    ]);

    const invoicedTotal = invoiced.reduce((s, i) => s + i.amountCents, 0);
    const collectedTotal = paid.reduce((s, p) => s + p.amountCents, 0);
    const expensesTotal = expenses.reduce((s, e) => s + e.amountCents, 0);

    res.json({
      currency: config.currency,
      invoicePrefix: config.invoicePrefix,
      receiptFooter: config.receiptFooter,
      period: { from, to: new Date() },
      invoiced: { count: invoiced.length, amountCents: invoicedTotal },
      collected: { count: paid.length, amountCents: collectedTotal },
      outstanding: {
        count: invoiced.length - paid.length,
        amountCents: invoicedTotal - collectedTotal,
      },
      expenses: { count: expenses.length, amountCents: expensesTotal },
      policy: {
        allowPartialPayments: config.allowPartialPayments,
        allowOverpayment: config.allowOverpayment,
        arrearsEnabled: config.arrearsEnabled,
        arrearsGraceDays: config.arrearsGraceDays,
      },
    });
  })
);

router.get(
  '/invoices',
  requirePermissions('finance.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listInvoicesSchema.parse(req.query);
    const invoices = await prisma.invoice.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.from || query.to
          ? {
              issuedAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { issuedAt: 'desc' },
      take: query.limit ?? 50,
    });
    res.json({ invoices });
  })
);

/** Create an invoice. Numbering and currency come from the school settings. */
router.post(
  '/invoices',
  requirePermissions('finance.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createInvoiceSchema.parse(req.body);
    const config = await financeConfigFor(req);

    const count = await prisma.invoice.count();
    const nextNumber = `${config.invoicePrefix}-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const invoice = await prisma.invoice.create({
      data: {
        studentId: payload.studentId,
        number: nextNumber,
        amountCents: payload.amountCents,
        currency: config.currency,
        dueDate: new Date(payload.dueDate),
        lineItems: (payload.lineItems ?? []) as never,
      },
    });

    res.status(201).json(invoice);
  })
);

async function financeConfigFor(req: Request, schoolId?: string) {
  const id = schoolId ?? (await resolveSchoolScope(req)).schoolId;
  const record = await prisma.schoolFinanceSettings.findUnique({
    where: { schoolId: id },
  });
  return {
    currency: record?.currency || 'KES',
    invoicePrefix: record?.invoicePrefix || 'INV',
    receiptPrefix: record?.receiptPrefix || 'RCT',
    receiptFooter: record?.receiptFooter || '',
    termsAndConditions: record?.termsAndConditions || '',
    allowPartialPayments: record?.allowPartialPayments ?? true,
    allowOverpayment: record?.allowOverpayment ?? false,
    arrearsEnabled: record?.arrearsEnabled ?? true,
    arrearsGraceDays: record?.arrearsGraceDays ?? 14,
  };
}
