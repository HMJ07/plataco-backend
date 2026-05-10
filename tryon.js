// backend/routes/tryon.js
// ============================================================
// Proxy seguro para la prueba virtual de joya con IA
// El frontend envía la imagen en base64 → este endpoint llama
// a la API de Anthropic desde el servidor (API key en .env).
// Ventajas:
//   1. La ANTHROPIC_API_KEY nunca queda expuesta en el cliente
//   2. Se puede cachear, limitar por usuario, loguear errores
//   3. max_tokens reducido a 350 → respuesta ~3x más rápida
// ============================================================
import { Router } from 'express';

const router = Router();

// POST /api/tryon/analyze
// Body: { image_base64: string, product_name: string, material: string }
router.post('/analyze', async (req, res) => {
  const { image_base64, product_name, material } = req.body;

  if (!image_base64) {
    return res.status(400).json({ error: 'image_base64 es obligatorio' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor' });
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001', // Haiku: mismo resultado, 5x más rápido que Sonnet
        max_tokens: 350,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image_base64 },
            },
            {
              type: 'text',
              text: `Eres un estilista de joyería de lujo. Analiza cómo luce "${product_name || 'esta joya'}" (${material || ''}) en la imagen.
Escribe exactamente 3 frases en español:
1) Cómo luce la joya en esa zona del cuerpo.
2) Qué favorece del estilo o tono de piel.
3) Una ocasión o combinación recomendada.
Tono: cálido, sofisticado, personal. Sin frases genéricas.`,
            },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, errBody);
      return res.status(502).json({ error: 'Error al consultar la IA. Inténtalo de nuevo.' });
    }

    const data = await anthropicRes.json();
    const opinion = data.content?.map(c => c.text || '').join('').trim()
      || 'Esta joya realza tu estilo de forma elegante y natural.';

    res.json({ opinion });
  } catch (err) {
    console.error('tryon analyze error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
