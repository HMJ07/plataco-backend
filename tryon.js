// backend/tryon.js
// ============================================================
// Probador Virtual IA — sin dependencias nuevas, solo Gemini
//
//  POST /api/tryon/compose
//    1. Descarga la imagen de la joya (server-side, sin CORS)
//    2. Llama a Gemini 2.5 Flash Image para quitar el fondo
//       → devuelve la joya sola sobre fondo blanco/transparente
//    3. Llama a Gemini 2.5 Flash Image para componer la imagen
//       final: persona + joya limpia → foto realista
//    4. Pide opinión del estilista a Gemini 2.0 Flash (texto)
//    Devuelve: { image_base64, image_mime, opinion }
//
//  POST /api/tryon/analyze — solo opinión (compatibilidad)
//    Devuelve: { opinion }
//
// Solo requiere GEMINI_API_KEY en .env — sin deps nuevas.
// ============================================================

import { Router } from 'express';

const router = Router();

// ── Descargar imagen externa → base64 + mime ──────────────
async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar imagen: ${res.status} ${url}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const mime   = contentType.split(';')[0].trim();
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString('base64'), mime };
}

// ── Llamar a Gemini ────────────────────────────────────────
async function callGemini({ parts, expectImage = false }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const model = expectImage
    ? 'gemini-2.5-flash-image-preview'
    : 'gemini-2.0-flash';

  const generationConfig = expectImage
    ? { responseModalities: ['TEXT', 'IMAGE'] }
    : { maxOutputTokens: 300, temperature: 0.7 };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res  = await fetch(url, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ contents: [{ parts }], generationConfig }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json();
}

// ── Parsear respuesta de Gemini ────────────────────────────
function parseGeminiResponse(data) {
  const parts     = data?.candidates?.[0]?.content?.parts || [];
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

// ── Fallback opinión sin IA ────────────────────────────────
function fallbackOpinion(productName, material) {
  const name = productName || 'esta joya';
  const mat  = (material  || '').toLowerCase();
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
// Body: { user_image_base64, jewel_url, product_name, material, category }
// ══════════════════════════════════════════════════════════
router.post('/compose', async (req, res) => {
  console.log('tryon/compose — llamada recibida, jewel_url:', req.body?.jewel_url?.slice(0, 80));
  const {
    user_image_base64,
    jewel_url,
    product_name,
    material,
    category = '',
  } = req.body;

  if (!user_image_base64) return res.status(400).json({ error: 'user_image_base64 es obligatorio' });
  if (!jewel_url)         return res.status(400).json({ error: 'jewel_url es obligatorio' });

  const cat  = (category || '').toLowerCase();
  const name = product_name || 'la joya';
  const mat  = material     || '';

  const placement =
    cat.includes('anillo')                                ? 'en el dedo de la mano' :
    cat.includes('pulsera')                               ? 'en la muñeca'          :
    cat.includes('collar') || cat.includes('gargantilla') ? 'en el cuello / escote' :
    cat.includes('pendiente')                             ? 'en la oreja'           :
    'en el lugar apropiado del cuerpo';

  // ── Paso 1: Descargar imagen de la joya ───────────────────
  let jewelBase64, jewelMime;
  try {
    const downloaded = await fetchImageAsBase64(jewel_url);
    jewelBase64 = downloaded.base64;
    jewelMime   = downloaded.mime;
  } catch (err) {
    console.error('tryon/compose — descarga joya:', err.message);
    return res.status(400).json({ error: `No se pudo obtener la imagen de la joya: ${err.message}` });
  }

  // ── Paso 2: Quitar fondo de la joya con Gemini ────────────
  // Le pedimos que devuelva solo la joya sobre fondo blanco puro,
  // sin packaging, sin sombras, sin nada más.
  let jewelCleanBase64 = jewelBase64;
  let jewelCleanMime   = jewelMime;
  try {
    const bgData = await callGemini({
      parts: [
        { text:
          'You are a professional photo editor.\n' +
          'Remove the background from this jewelry product image completely.\n' +
          'Output ONLY the jewelry piece itself on a pure white background.\n' +
          'Remove any packaging, boxes, surfaces, shadows, or other elements.\n' +
          'Keep the jewelry sharp and detailed. Output a clean product photo.'
        },
        { inline_data: { mime_type: jewelMime, data: jewelBase64 } },
      ],
      expectImage: true,
    });
    const parsed = parseGeminiResponse(bgData);
    if (parsed.imageBase64) {
      jewelCleanBase64 = parsed.imageBase64;
      jewelCleanMime   = parsed.imageMime;
      console.log('tryon/compose — fondo eliminado con Gemini');
    } else {
      console.warn('tryon/compose — Gemini no devolvió imagen en paso de recorte, usando original');
    }
  } catch (err) {
    console.warn('tryon/compose — error quitando fondo, usando imagen original:', err.message);
  }

  // ── Paso 3: Componer imagen final con Gemini ─────────────
  let composedBase64 = null;
  let composedMime   = 'image/png';
  try {
    const composeData = await callGemini({
      parts: [
        { text:
          'You are a professional jewelry photo retoucher.\n\n' +
          'TASK: Edit the FIRST image (person photo) so the person is wearing the jewelry from the SECOND image.\n\n' +
          `The SECOND image shows only the jewelry "${name}" (${mat}) on a white background — place it ${placement} as it would naturally appear when worn.\n\n` +
          'Rules:\n' +
          '- Keep the person\'s face, skin tone, clothing, pose and background EXACTLY as they are. Do not alter them.\n' +
          '- Integrate the jewelry naturally: correct size, angle, lighting and shadows matching the photo.\n' +
          '- The result must look like a real photo, not a montage.\n' +
          '- Output a single photorealistic image. No text, no watermarks, no borders.'
        },
        { inline_data: { mime_type: 'image/jpeg',      data: user_image_base64 } },
        { inline_data: { mime_type: jewelCleanMime,    data: jewelCleanBase64  } },
      ],
      expectImage: true,
    });
    const parsed   = parseGeminiResponse(composeData);
    composedBase64 = parsed.imageBase64;
    composedMime   = parsed.imageMime;

    if (!composedBase64) {
      console.error('tryon/compose — SIN IMAGEN. Texto Gemini:', parsed.text);
      console.error('tryon/compose — Raw candidates:', JSON.stringify(composeData?.candidates?.[0]?.finishReason));
    } else {
      console.log('tryon/compose — imagen generada OK, mime:', composedMime, 'bytes aprox:', composedBase64.length);
    }
  } catch (err) {
    console.error('tryon/compose — ERROR COMPOSICIÓN:', err.message);
  }

  // ── Paso 4: Opinión del estilista ─────────────────────────
  let opinion = null;
  try {
    const imgForOpinion  = composedBase64 ?? user_image_base64;
    const mimeForOpinion = composedBase64 ? composedMime : 'image/jpeg';

    const opData = await callGemini({
      parts: [
        { inline_data: { mime_type: mimeForOpinion, data: imgForOpinion } },
        { text:
          `Eres un estilista de joyería de lujo. Analiza cómo luce "${name}" (${mat}) ${placement} en la imagen.\n` +
          'Escribe exactamente 3 frases en español:\n' +
          '1) Cómo luce la joya en esa zona del cuerpo.\n' +
          '2) Qué favorece del estilo o tono de piel.\n' +
          '3) Una ocasión o combinación recomendada.\n' +
          'Tono: cálido, sofisticado, personal. Sin numeración, escribe las 3 frases seguidas.'
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
// POST /api/tryon/analyze — solo opinión (compatibilidad)
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
          'Escribe exactamente 3 frases en español:\n' +
          '1) Cómo luce la joya en esa zona del cuerpo.\n' +
          '2) Qué favorece del estilo o tono de piel.\n' +
          '3) Una ocasión o combinación recomendada.\n' +
          'Tono: cálido, sofisticado, personal. Sin numeración, escribe las 3 frases seguidas.'
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
