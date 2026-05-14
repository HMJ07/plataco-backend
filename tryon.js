// backend/tryon.js
// ============================================================
// Probador Virtual IA
//
//  POST /api/tryon/compose
//    1. Descarga la imagen de la joya (server-side, sin CORS)
//    2. Quita el fondo con @imgly/background-removal-node
//       → devuelve PNG con canal alpha (fondo transparente)
//    3. Llama a Gemini 2.5 Flash Image con la foto del usuario
//       + la joya recortada → genera imagen realista compuesta
//    4. Pide opinión del estilista a Gemini 2.0 Flash (texto)
//    Devuelve: { image_base64, image_mime, opinion }
//
//  POST /api/tryon/analyze  — solo opinión (compatibilidad)
//    Devuelve: { opinion }
//
// Deps nuevas: @imgly/background-removal-node
//   npm install @imgly/background-removal-node
// ============================================================

import { Router }    from 'express';
import { removeBackground } from '@imgly/background-removal-node';

const router = Router();

// ── Descargar imagen externa → Buffer + mime ───────────────
async function fetchImageBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar imagen: ${res.status} ${url}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const mime   = contentType.split(';')[0].trim();
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mime };
}

// ── Quitar fondo de la joya → PNG base64 transparente ─────
async function removeJewelBackground(imageBuffer) {
  // removeBackground acepta Buffer y devuelve un Blob con el PNG resultante
  const blob       = await removeBackground(imageBuffer);
  const arrayBuf   = await blob.arrayBuffer();
  const pngBuffer  = Buffer.from(arrayBuf);
  return pngBuffer.toString('base64'); // base64 de PNG con alpha
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
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
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
    if (p.inlineData) { imageBase64 = p.inlineData.data; imageMime = p.inlineData.mimeType || 'image/png'; }
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
  let jewelBuffer, jewelMime;
  try {
    const downloaded = await fetchImageBuffer(jewel_url);
    jewelBuffer = downloaded.buffer;
    jewelMime   = downloaded.mime;
  } catch (err) {
    console.error('tryon/compose — descarga joya:', err.message);
    return res.status(400).json({ error: `No se pudo obtener la imagen de la joya: ${err.message}` });
  }

  // ── Paso 2: Quitar fondo de la joya ───────────────────────
  let jewelBase64 = null;
  let jewelFinalMime = 'image/png';
  try {
    jewelBase64     = await removeJewelBackground(jewelBuffer);
    jewelFinalMime  = 'image/png'; // removeBackground siempre devuelve PNG
    console.log('tryon/compose — fondo eliminado correctamente');
  } catch (err) {
    console.warn('tryon/compose — no se pudo quitar fondo, usando imagen original:', err.message);
    // Fallback: usar imagen original sin recortar
    jewelBase64    = jewelBuffer.toString('base64');
    jewelFinalMime = jewelMime;
  }

  // ── Paso 3: Generar imagen compuesta con Gemini ───────────
  let composedBase64 = null;
  let composedMime   = 'image/png';

  try {
    const prompt =
      `You are a professional jewelry photo retoucher.\n\n` +
      `TASK: Edit the FIRST image (person photo) so the person is wearing the jewelry from the SECOND image.\n\n` +
      `The SECOND image is a PNG with a transparent background — it contains only the jewelry piece with no background.\n\n` +
      `Instructions:\n` +
      `- Place "${name}" (${mat}) ${placement} as it would naturally appear when worn.\n` +
      `- Keep the person's face, skin tone, clothing, pose and background EXACTLY as they are.\n` +
      `- Match the jewelry lighting and shadows to the photo's existing light source so it looks real.\n` +
      `- Use a realistic, proportional size for the jewelry on the person's body.\n` +
      `- Output a single photorealistic image. No text, no watermarks, no borders.`;

    const data = await callGemini({
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: user_image_base64 } },
        { inline_data: { mime_type: jewelFinalMime, data: jewelBase64     } },
      ],
      expectImage: true,
    });

    const parsed   = parseGeminiResponse(data);
    composedBase64 = parsed.imageBase64;
    composedMime   = parsed.imageMime;

    if (!composedBase64) {
      console.warn('tryon/compose — Gemini no devolvió imagen:', parsed.text?.slice(0, 200));
    }
  } catch (err) {
    console.error('tryon/compose — error Gemini imagen:', err.message);
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
