// backend/tryon.js
// ============================================================
// Probador Virtual IA — Gemini 2.0 Flash Image Generation
//
//  POST /api/tryon/compose
//    1. Descarga la imagen de la joya (server-side, sin CORS)
//    2. Un único prompt a Gemini para componer persona + joya
//       de forma realista (sin pasos intermedios que fallan)
//    3. Opinión del estilista con Gemini 2.0 Flash (texto)
//    Devuelve: { image_base64, image_mime, opinion }
//
//  POST /api/tryon/analyze — solo opinión (compatibilidad)
//    Devuelve: { opinion }
//
// Solo requiere GEMINI_API_KEY en .env
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
    ? 'gemini-2.0-flash-preview-image-generation'
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

// ── Construir prompt de composición según categoría ───────
function buildComposePrompt(name, mat, cat) {
  const catLower = (cat || '').toLowerCase();

  let placementInstruction = '';
  if (catLower.includes('anillo')) {
    placementInstruction =
      'Place the ring on one of the person\'s fingers. ' +
      'Scale it to fit naturally on the finger, matching the finger\'s angle and lighting.';
  } else if (catLower.includes('pulsera')) {
    placementInstruction =
      'Place the bracelet around the person\'s wrist. ' +
      'Wrap it naturally around the wrist, matching its curve, angle, and the photo\'s lighting.';
  } else if (catLower.includes('collar') || catLower.includes('gargantilla')) {
    placementInstruction =
      'Place the necklace around the person\'s neck, resting naturally on the chest/décolletage. ' +
      'Follow the natural curve of the neckline and match the lighting.';
  } else if (catLower.includes('pendiente')) {
    placementInstruction =
      'Place the earring(s) on the person\'s ear(s), positioned naturally on the earlobe. ' +
      'Match the angle of the head, scale, and lighting.';
  } else {
    placementInstruction =
      'Identify the most appropriate body part for this jewelry and place it there naturally.';
  }

  return (
    'You are an expert photo editor specializing in jewelry try-on.\n\n' +
    'You are given TWO images:\n' +
    '- IMAGE 1: A photo of a person (this is the base photo — do NOT alter the person, their pose, skin, clothing, or background in any way).\n' +
    '- IMAGE 2: A product photo of a jewelry piece.\n\n' +
    `JEWELRY: "${name}" made of ${mat || 'metal'}.\n\n` +
    'YOUR TASK:\n' +
    `${placementInstruction}\n\n` +
    'STRICT RULES:\n' +
    '1. IGNORE the background of IMAGE 2 completely — extract only the jewelry itself, removing any black, white or colored background.\n' +
    '2. Do NOT paste the jewelry as a flat rectangle or stamp on top of the photo. Integrate it realistically with correct perspective, scale, curvature, and shadows.\n' +
    '3. The jewelry must look like it is physically ON and touching the person\'s body, not floating or overlaid.\n' +
    '4. Preserve every detail of the person exactly: face, skin tone, hair, clothes, background.\n' +
    '5. Match the lighting and color temperature of IMAGE 1.\n' +
    '6. Output ONE photorealistic image. No text, no borders, no watermarks.'
  );
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

  const name = product_name || 'la joya';
  const mat  = material     || '';

  // ── Paso 1: Descargar imagen de la joya ───────────────────
  let jewelBase64, jewelMime;
  try {
    const downloaded = await fetchImageAsBase64(jewel_url);
    jewelBase64 = downloaded.base64;
    jewelMime   = downloaded.mime;
    console.log('tryon/compose — joya descargada, mime:', jewelMime);
  } catch (err) {
    console.error('tryon/compose — descarga joya:', err.message);
    return res.status(400).json({ error: `No se pudo obtener la imagen de la joya: ${err.message}` });
  }

  // ── Paso 2: Composición directa en un solo prompt ─────────
  let composedBase64 = null;
  let composedMime   = 'image/png';
  try {
    const prompt = buildComposePrompt(name, mat, category);
    console.log('tryon/compose — enviando a Gemini...');

    const composeData = await callGemini({
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: user_image_base64 } },
        { inline_data: { mime_type: jewelMime,    data: jewelBase64 } },
      ],
      expectImage: true,
    });

    const parsed   = parseGeminiResponse(composeData);
    composedBase64 = parsed.imageBase64;
    composedMime   = parsed.imageMime;

    if (!composedBase64) {
      const finishReason = composeData?.candidates?.[0]?.finishReason;
      console.error('tryon/compose — SIN IMAGEN. finishReason:', finishReason);
      console.error('tryon/compose — texto Gemini:', parsed.text);
    } else {
      console.log('tryon/compose — imagen generada OK, mime:', composedMime, 'bytes aprox:', composedBase64.length);
    }
  } catch (err) {
    console.error('tryon/compose — ERROR COMPOSICIÓN:', err.message);
  }

  // ── Paso 3: Opinión del estilista ─────────────────────────
  let opinion = null;
  try {
    const catLower = (category || '').toLowerCase();
    const placement =
      catLower.includes('anillo')                                    ? 'en el dedo'    :
      catLower.includes('pulsera')                                   ? 'en la muñeca'  :
      catLower.includes('collar') || catLower.includes('gargantilla') ? 'en el cuello'  :
      catLower.includes('pendiente')                                 ? 'en la oreja'   :
      'en el cuerpo';

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
