import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../shared/errorHandler";

export const router = Router();

const storage = multer.diskStorage({
    destination: (_req: any, _file: any, cb: any) => {
        cb(null, "uploads/");
    },
    filename: (_req: any, file: any, cb: any) => {
        const uniqueSuffix = uuidv4();
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (_req: any, file: any, cb: any) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new ApiError(400, "Only JPEG, PNG and WebP images are allowed") as any, false);
        }
    },
});

router.post("/", upload.single("file"), (req: Request, res: Response) => {
    if (!(req as any).file) {
        throw new ApiError(400, "No file uploaded");
    }

    const fileUrl = `${process.env.BACKEND_URL || "http://localhost:4000"}/uploads/${(req as any).file.filename}`;
    res.json({ url: fileUrl });
});
