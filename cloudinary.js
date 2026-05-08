// ============================================================
// PLATACO — Servicio de subida de imágenes con Cloudinary
// ============================================================
// Variables de entorno necesarias en Railway:
//   CLOUDINARY_CLOUD_NAME=tu_cloud_name
//   CLOUDINARY_API_KEY=tu_api_key
//   CLOUDINARY_API_SECRET=tu_api_secret
//
// Cómo obtener las credenciales (es gratis):
//   1. Regístrate en https://cloudinary.com
//   2. En el Dashboard verás Cloud Name, API Key y API Secret
//   3. Cópialas en las variables de entorno de Railway
// ============================================================

import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { Readable } from 'stream';

/**
 * Sube un buffer de imagen a Cloudinary y devuelve las URLs generadas.
 * Se configura aquí (no al importar) para garantizar que las env vars están cargadas.
 */
export async function uploadToCloudinary(buffer, { folder = 'plataco/products', publicId } = {}) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id:      publicId,
        overwrite:      true,
        resource_type:  'image',
        // Transformaciones automáticas al subir
        eager: [
          { width: 200,  height: 200,  crop: 'fill', quality: 'auto', fetch_format: 'auto' }, // thumb
          { width: 600,  height: 600,  crop: 'fill', quality: 'auto', fetch_format: 'auto' }, // medium
        ],
        eager_async: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          cloudinary_id: result.public_id,
          url:           result.secure_url,
          url_thumb:     result.eager?.[0]?.secure_url || result.secure_url,
          url_medium:    result.eager?.[1]?.secure_url || result.secure_url,
        });
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
}

/**
 * Elimina una imagen de Cloudinary por su public_id.
 */
export async function deleteFromCloudinary(cloudinaryId) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return cloudinary.uploader.destroy(cloudinaryId);
}

/**
 * Middleware multer: acepta imágenes en memoria (max 5 MB).
 * Uso: upload.single('image')  /  upload.array('images', 10)
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB por archivo
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Solo JPEG, PNG, WEBP o GIF.'));
    }
  },
});
