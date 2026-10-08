import { Router, type Request, type Response } from 'express';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { StorageProvider } from '../../infrastructure/storage';
import { schoolScopeOf, requireSchoolScope } from '../settings/scope';

/**
 * Branding asset uploads.
 *
 * Reuses the existing StorageProvider (local disk or S3) rather than adding a
 * second upload mechanism. The request body is the raw image bytes and the
 * filename travels as a query parameter, which avoids pulling in a multipart
 * parser for one endpoint.
 *
 *   POST /api/uploads/branding?kind=logo&filename=logo.png
 *   Content-Type: image/png
 */
export const router: Router = Router();

const storage = new StorageProvider();

const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
];

const MAX_BYTES = 5 * 1024 * 1024;

/** Branding images the school can supply. */
const BRANDING_KINDS = ['logo', 'favicon', 'cover'] as const;

async function handleUpload(req: Request, res: Response): Promise<void> {
  const contentType = String(req.headers['content-type'] ?? '')
    .split(';')[0]
    .trim();

  if (!IMAGE_TYPES.includes(contentType)) {
    throw new ApiError(415, 'The image must be a PNG, JPEG, WebP, SVG or icon file');
  }

  const buffer = req.body as Buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ApiError(400, 'No image data was received');
  }
  if (buffer.length > MAX_BYTES) {
    throw new ApiError(413, 'Image must be 5 MB or smaller');
  }

  // `cover` is the institution's photograph, shown on the sign-in panel.
  const raw = String(req.query.kind ?? 'logo');
  if (!BRANDING_KINDS.some((k) => k === raw)) {
    throw new ApiError(400, `kind must be one of: ${BRANDING_KINDS.join(', ')}`);
  }
  const kind = raw as (typeof BRANDING_KINDS)[number];

  const requested = String(req.query.filename ?? `branding.${contentType.split('/')[1] ?? 'png'}`)
    // Never trust a path from the client.
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .slice(-64);

  const { schoolId } = schoolScopeOf(req);
  const stored = await storage.upload(buffer, requested, `branding/${schoolId}/${kind}`);

  res.status(201).json({
    kind,
    url: stored.url,
    filename: stored.filename,
    size: stored.size,
    contentType,
  });
}

// The school is resolved from the caller's membership, never from the
// request, so one institution's files cannot be written under another's.
router.use(requireSchoolScope());

router.post('/branding', requirePermissions('settings.manage'), asyncHandler(handleUpload));
