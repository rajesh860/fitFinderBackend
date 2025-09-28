// uploadMiddleware.js
import multer from "multer";
import fs from "fs";
import path from "path";

// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/**
 * ✅ Reusable middleware
 * fields: string array or object array
 * - single image => req.file
 * - multiple images => req.files[fieldName] array
 */
export const uploadMiddleware = (fields = []) => {
  if (!fields || fields.length === 0) {
    return (req, res, next) => {
      upload.any()(req, res, (err) => {
        if (err) return next(err);

        // Agar sirf ek file aayi, req.file me set kar do
        if (req.files && req.files.length === 1) {
          req.file = req.files[0];
        }
        next();
      });
    };
  }

  if (fields.length === 1 && typeof fields[0] === "string") {
    // single field: "photo" ya "images"
    return (req, res, next) => {
      upload.array(fields[0], 10)(req, res, (err) => {
        if (err) return next(err);

        if (req.files && req.files.length === 1) {
          req.file = req.files[0]; // single image case
        }
        next();
      });
    };
  }

  // agar string array diya (["photo", "id_proof"])
  if (typeof fields[0] === "string") {
    const multerFields = fields.map((name) => ({ name, maxCount: 10 }));
    return (req, res, next) => {
      upload.fields(multerFields)(req, res, (err) => {
        if (err) return next(err);
        next();
      });
    };
  }

  // agar object array diya ([{ name: "images", maxCount: 10 }, { name: "coverImage", maxCount: 1 }])
  if (typeof fields[0] === "object") {
    return (req, res, next) => {
      upload.fields(fields)(req, res, (err) => {
        if (err) return next(err);
        next();
      });
    };
  }

  return (req, res, next) => upload.any()(req, res, next);
};
