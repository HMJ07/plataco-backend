// backend/routes/tryon.js
// ============================================================
// Proxy seguro para la prueba virtual de joya con IA
// GRATUITO: usa Google Gemini Flash (tier free: 1.500 req/día)
//   → Regístrate en https://aistudio.google.com/app/apikey
//   → Variable de entorno: GEMINI_API_KEY
//
// Fallback automático si no hay API key: respuesta estática
// elegante basada en el producto (sin coste, sin error visible).
// ============================================================
import { Router } from 'express';

const router = Router();

// Respuestas de fallback elegantes por tipo de material/joya
// Se usan cuando no hay API key configurada o falla la IA.
function fallbackOpinion(productName, material) {
  const name = productName || 'esta joya';
  const mat  = (material || '').toLowerCase();
  const isGold   = mat.includes('oro') || mat.includes('gold') || mat.includes('vermeil');
  const isSilver = mat.includes('plata') || mat.includes('silver') || mat.includes('925');

  const tone = isGold
    ? 'Los tonos dorados aportan calidez y luminosidad, realzando la belleza natural de tu piel.'
    : isSilver
    ? 'La plata de ley 925 aporta un brillo frío y elegante que complementa cualquier tono de piel.'
    : 'El acabado de esta joya aporta un brillo sofisticado que complementa tu look de forma natural.';

  return `${name} luce de forma excepcional, aportando un toque de distinción y feminidad. ${tone} Perfecta tanto para una ocasión especial como para elevar un look cotidiano.`;
}

// POST /api/tryon/analyze
// Body: { image_base64: string, product_name: string, material: string }
router.post('/analyze', async (req, res) => {
  const { image_base64, product_name, material } = req.body;

  if (!image_base64) {
    return res.status(400).json({ error: 'image_base64 es obligatorio' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // ── Sin API key → fallback elegante (no rompe la UX) ──
  if (!apiKey) {
    console.warn('GEMINI_API_KEY no configurada — usando respuesta de fallback');
    return res.json({ opinion: fallbackOpinion(product_name, material) });
  }

  try {
    // Gemini 2.0 Flash — gratis: 1.500 req/día, 1M tokens/min
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: image_base64,
              },
            },
            {
              text: `Eres un estilista de joyería de lujo. Analiza cómo luce "${product_name || 'esta joya'}" (${material || ''}) en la imagen.
Escribe exactamente 3 frases en español:
1) Cómo luce la joya en esa zona del cuerpo.
2) Qué favorece del estilo o tono de piel.
3) Una ocasión o combinación recomendada.
Tono: cálido, sofisticado, personal. Sin frases genéricas. Sin numeración, escribe las 3 frases seguidas.`,
            },
          ],
        }],
        generationConfig: {
          maxOutputTokens: 250,
          temperature: 0.7,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errBody);
      // Fallback silencioso en vez de devolver error 502
      return res.json({ opinion: fallbackOpinion(product_name, material) });
    }

    const data = await geminiRes.json();
    const opinion =
      data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim()
      || fallbackOpinion(product_name, material);

    res.json({ opinion });
  } catch (err) {
    console.error('tryon analyze error:', err);
    // Fallback silencioso para no romper la UX
    res.json({ opinion: fallbackOpinion(product_name, material) });
  }
});

export default router;
