// backend/tryon.js
// ============================================================
// Probador Virtual IA — dos endpoints:
//
//  POST /api/tryon/compose
//    Recibe la foto del usuario + imagen de la joya,
//    llama a Gemini 2.5 Flash Image para generar una imagen
//    nueva realista con la joya puesta en la persona.
//    Devuelve: { image_base64: string, image_mime: string, opinion: string }
//
//  POST /api/tryon/analyze   (mantiene compatibilidad anterior)
//    Solo opinión del estilista (sin generación de imagen).
//    Devuelve: { opinion: string }
//
// Modelo de imagen: gemini-2.5-flash-image-preview
//   → edita fotos reales a partir de lenguaje natural + imágenes
//   → precio: ~$0.039 por imagen (~1290 output tokens a $30/1M)
//   → requiere GEMINI_API_KEY en .env
//
// Fallback automático si falla la IA o no hay API key.
// ============================================================

import { Router } from 'express';

const router = Router();

// ── Llamar a Gemini (texto o imagen) ─────────────────────
async function callGemini({ parts, expectImage = false }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  // Para generación de imagen usamos el modelo de imagen de Gemini 2.5 Flash
  // Para solo texto usamos gemini-2.0-flash (más barato)
  const model = expectImage
    ? 'gemini-2.5-flash-image-preview'
    : 'gemini-2.0-flash';

  const generationConfig = expectImage
    ? { responseModalities: ['TEXT', 'IMAGE'] }
    : { maxOutputTokens: 300, temperature: 0.7 };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// ── Parsear respuesta de Gemini (texto + imagen opcional) ─
function parseGeminiResponse(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  let text        = '';
  let imageBase64 = null;
  let imageMime   = 'image/png';

  for (const p of parts) {
    if (p.text)       text += p.text;
    if (p.inlineData) {
      imageBase64 = p.inlineData.data;
      imageMime   = p.inlineData.mimeType || 'image/png';
    }
  }
  return { text: text.trim(), imageBase64, imageMime };
}

// ── Fallback de opinión (sin IA) ──────────────────────────
function fallbackOpinion(productName, material) {
  const name = productName || 'esta joya';
  const mat  = (material || '').toLowerCase();
  const tone =
    mat.includes('oro') || mat.includes('gold') || mat.includes('vermeil')
      ? 'Los tonos dorados aportan calidez y luminosidad, realzando la belleza natural de tu piel.'
      : mat.includes('plata') || mat.includes('silver') || mat.includes('925')
      ? 'La plata de ley 925 aporta un brillo frío y elegante que complementa cualquier tono de piel.'
      : 'El acabado de esta joya aporta un brillo sofisticado que complementa tu look de forma natural.';
  return `${name} luce de forma excepcional, aportando un toque de distinción y feminidad. ${tone} Perfecta tanto para una ocasión especial como para elevar un look cotidiano.`;
}

// ══════════════════════════════════════════════════════════
// POST /api/tryon/compose
//
// Body (JSON):
//   user_image_base64  : string  — foto del usuario (base64 puro, sin "data:...")
//   jewel_url          : string  — URL pública de la imagen de la joya (el backend la descarga)
//   product_name       : string
//   material           : string
//   category           : string  — "anillos"|"collares"|"pulseras"|"pendientes"
//
// Respuesta:
//   {
//     image_base64 : string | null,   ← null si la IA falló
//     image_mime   : string,
//     opinion      : string
//   }
// ══════════════════════════════════════════════════════════
// ── Descargar imagen externa y convertir a base64 ─────────
async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar imagen: ${res.status} ${url}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const mime = contentType.split(';')[0].trim();
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return { base64, mime };
}

router.post('/compose', async (req, res) => {
  const {
    user_image_base64,
    jewel_url,
    product_name,
    material,
    category = '',
  } = req.body;

  if (!user_image_base64) return res.status(400).json({ error: 'user_image_base64 es obligatorio' });
  if (!jewel_url)         return res.status(400).json({ error: 'jewel_url es obligatorio' });

  // Descargar la imagen de la joya server-side (evita CORS del navegador)
  let jewel_image_base64, jewel_mime;
  try {
    const downloaded = await fetchImageAsBase64(jewel_url);
    jewel_image_base64 = downloaded.base64;
    jewel_mime         = downloaded.mime;
  } catch (err) {
    console.error('tryon/compose — error descargando imagen de joya:', err.message);
    return res.status(400).json({ error: `No se pudo obtener la imagen de la joya: ${err.message}` });
  }

  const user_mime = 'image/jpeg';

  const cat  = (category || '').toLowerCase();
  const name = product_name || 'la joya';
  const mat  = material     || '';

  const placement =
    cat.includes('anillo')                                      ? 'en el dedo de la mano' :
    cat.includes('pulsera')                                     ? 'en la muñeca' :
    cat.includes('collar') || cat.includes('gargantilla')       ? 'en el cuello / escote' :
    cat.includes('pendiente')                                   ? 'en la oreja' :
    'en el lugar apropiado del cuerpo';

  // ── Paso 1: Generar imagen compuesta ─────────────────────
  let composedBase64 = null;
  let composedMime   = 'image/png';

  try {
    const prompt =
      `You are a professional jewelry photo retoucher.\n\n` +
      `TASK: Edit the FIRST image (person photo) so the person is wearing the jewelry shown in the SECOND image.\n\n` +
      `Instructions:\n` +
      `- The jewelry is "${name}" (${mat}). Place it ${placement} as it would naturally appear when worn.\n` +
      `- Remove the jewelry's background/packaging — keep only the jewelry piece itself.\n` +
      `- Keep the person's face, skin tone, clothing, pose and background EXACTLY as they are. Do not alter them.\n` +
      `- Match the jewelry lighting and shadows to the photo's light source so it looks fully integrated.\n` +
      `- Use a realistic, proportional size for the jewelry on the person's body.\n` +
      `- Output a single photorealistic image. No text, no watermarks, no borders.`;

    const data = await callGemini({
      parts: [
        { text: prompt },
        { inline_data: { mime_type: user_mime,  data: user_image_base64  } },
        { inline_data: { mime_type: jewel_mime, data: jewel_image_base64 } },
      ],
      expectImage: true,
    });

    const parsed   = parseGeminiResponse(data);
    composedBase64 = parsed.imageBase64;
    composedMime   = parsed.imageMime;

    if (!composedBase64) {
      console.warn('tryon/compose: Gemini devolvió respuesta sin imagen.', parsed.text?.slice(0, 200));
    }
  } catch (err) {
    console.error('tryon/compose — error generando imagen:', err.message);
    // Continúa: devolvemos null y el frontend usa la superposición manual de fallback
  }

  // ── Paso 2: Opinión del estilista ─────────────────────────
  let opinion = null;
  try {
    // Si tenemos imagen generada la usamos para el análisis; si no, la foto original
    const imgForOpinion  = composedBase64 ?? user_image_base64;
    const mimeForOpinion = composedBase64 ? composedMime : user_mime;

    const opData = await callGemini({
      parts: [
        { inline_data: { mime_type: mimeForOpinion, data: imgForOpinion } },
        { text:
          `Eres un estilista de joyería de lujo. Analiza cómo luce "${name}" (${mat}) ${placement} en la imagen.\n` +
          `Escribe exactamente 3 frases en español:\n` +
          `1) Cómo luce la joya en esa zona del cuerpo.\n` +
          `2) Qué favorece del estilo o tono de piel.\n` +
          `3) Una ocasión o combinación recomendada.\n` +
          `Tono: cálido, sofisticado, personal. Sin numeración, escribe las 3 frases seguidas.`
        },
      ],
      expectImage: false,
    });
    const parsed = parseGeminiResponse(opData);
    opinion = parsed.text || null;
  } catch (err) {
    console.warn('tryon/compose — error opinión:', err.message);
  }

  res.json({
    image_base64 : composedBase64,
    image_mime   : composedMime,
    opinion      : opinion || fallbackOpinion(product_name, material),
  });
});

// ══════════════════════════════════════════════════════════
// POST /api/tryon/analyze  — solo opinión (compatibilidad)
// Body: { image_base64, product_name, material }
// ══════════════════════════════════════════════════════════
router.post('/analyze', async (req, res) => {
  const { image_base64, product_name, material } = req.body;
  if (!image_base64) return res.status(400).json({ error: 'image_base64 es obligatorio' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.json({ opinion: fallbackOpinion(product_name, material) });

  try {
    const data = await callGemini({
      parts: [
        { inline_data: { mime_type: 'image/jpeg', data: image_base64 } },
        { text:
          `Eres un estilista de joyería de lujo. Analiza cómo luce "${product_name || 'esta joya'}" (${material || ''}) en la imagen.\n` +
          `Escribe exactamente 3 frases en español:\n` +
          `1) Cómo luce la joya en esa zona del cuerpo.\n` +
          `2) Qué favorece del estilo o tono de piel.\n` +
          `3) Una ocasión o combinación recomendada.\n` +
          `Tono: cálido, sofisticado, personal. Sin numeración, escribe las 3 frases seguidas.`
        },
      ],
      expectImage: false,
    });
    const { text } = parseGeminiResponse(data);
    res.json({ opinion: text || fallbackOpinion(product_name, material) });
  } catch (err) {
    console.error('tryon/analyze error:', err.message);
    res.json({ opinion: fallbackOpinion(product_name, material) });
  }
});

export default router;
