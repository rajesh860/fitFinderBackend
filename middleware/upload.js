import multer from "multer";
import multerS3 from "multer-s3";
import { s3 } from "../config/s3.js";

const storage = multerS3({
  s3,
  bucket: process.env.AWS_BUCKET_NAME,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `uploads/${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage });

export const uploadMiddleware = (fields = []) => {
  const multerFields = fields.map((f) =>
    typeof f === "string" ? { name: f, maxCount: 10 } : f
  );
  return (req, res, next) => {
    upload.fields(multerFields)(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  };
};
