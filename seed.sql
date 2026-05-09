-- ============================================================
-- PLATACO — Datos de ejemplo (productos, variantes)
-- ============================================================

-- Anillos
INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Anillo Infinito', 'anillo-infinito', 'Anillo de banda continua símbolo del infinito. Diseño minimalista de línea pura, perfecto para apilar o llevar solo. Ideal para uso diario por su resistencia y comodidad.', 'Plata 925 · Acabado pulido', 42.00, 50, id, NULL, 3.2, '925', 'Pulido espejo', true, true FROM categories WHERE slug='anillos';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Anillo Sello Oval', 'anillo-sello-oval', 'Anillo sello con chatón oval liso, perfecto para grabar iniciales o un diseño personalizado. Estructura sólida con acabado satinado en la banda.', 'Plata 925 · Sello macizo', 89.00, 20, id, NULL, 8.5, '925', 'Satinado', false, true FROM categories WHERE slug='anillos';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Anillo Apilable Texturizado', 'anillo-apilable-texturizado', 'Anillo fino con textura martillada a mano. Perfecto para combinar con otros anillos. Su acabado rústico contrasta bellamente con piezas lisas.', 'Plata 925 · Textura martillada', 28.00, 80, id, NULL, 1.8, '925', 'Martillado', false, true FROM categories WHERE slug='anillos';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Anillo Medio Dedo Open', 'anillo-medio-dedo-open', 'Anillo de media falange con diseño abierto ajustable. Se coloca en la falange media del dedo. Delicado y moderno, ideal para llevar en capas.', 'Plata 925 · Abierto ajustable', 33.00, 40, id, NULL, 2.0, '925', 'Pulido', false, true FROM categories WHERE slug='anillos';

-- Collares
INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Collar Luna Creciente', 'collar-luna-creciente', 'Delicado colgante en forma de luna creciente con textura martillada que captura la luz de manera única. Cadena tipo Singapur incluida. Cierre de mosquetón.', 'Plata 925 · Cadena fina 45cm', 68.00, 35, id, 'Bestseller', 4.1, '925', 'Martillado', true, true FROM categories WHERE slug='collares';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Collar Gargantilla Twist', 'collar-gargantilla-twist', 'Gargantilla rígida con diseño trenzado trabajado a mano. Se adapta al cuello y puede abrirse ligeramente. Acabado brillante que refleja la luz con elegancia.', 'Plata 925 · Trenzado a mano', 92.00, 15, id, 'New', 22.0, '925', 'Pulido espejo', true, true FROM categories WHERE slug='collares';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Collar Perlas de Plata', 'collar-perlas-plata', 'Collar de bolas de plata perfectamente esféricas ensartadas en hilo de acero inoxidable. Cierre de tornillo también en plata. Elegante y versátil.', 'Plata 925 · Bolas 4mm', 75.00, 25, id, NULL, 14.0, '925', 'Pulido', false, true FROM categories WHERE slug='collares';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Collar Cadena Anchor', 'collar-cadena-anchor', 'Collar de cadena anchor (ancla) de eslabones ovalados en relieve. Aspecto robusto pero ligero. Compatible con cualquier colgante de argolla.', 'Plata 925 · Cadena marinera', 58.00, 30, id, NULL, 18.0, '925', 'Pulido', false, true FROM categories WHERE slug='collares';

-- Pulseras
INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Pulsera Esclava Grabada', 'pulsera-esclava-grabada', 'Pulsera tipo esclava con diseño de hojas grabadas a láser. Apertura lateral con bisagra y cierre de seguridad. Posibilidad de personalización bajo pedido.', 'Plata 925 · Grabado láser', 54.00, 30, id, 'New', 12.0, '925', 'Satinado', false, true FROM categories WHERE slug='pulseras';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Pulsera Cadena Figaro', 'pulsera-cadena-figaro', 'Pulsera de cadena Figaro clásica en plata de ley. Eslabones alternados 3+1 con cierre de mosquetón. Disponible en diferentes longitudes.', 'Plata 925 · Cadena italiana', 38.00, 45, id, NULL, 6.0, '925', 'Pulido', false, true FROM categories WHERE slug='pulseras';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Pulsera Charm Corazón', 'pulsera-charm-corazon', 'Pulsera de cadena rolo con charm de corazón sólido. Posibilidad de añadir más charms. Cierre de mosquetón con seguro.', 'Plata 925 · Cadena Rolo', 48.00, 35, id, NULL, 5.5, '925', 'Pulido', false, true FROM categories WHERE slug='pulseras';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Pulsera Tejida Macramé Plata', 'pulsera-tejida-macrame-plata', 'Pulsera artesanal tejida en hilo de plata con técnica macramé. Pieza única y artesanal. Cierre de bola deslizante.', 'Plata 925 · Hilo de plata', 82.00, 12, id, 'New', 7.0, '925', 'Mate artesanal', true, true FROM categories WHERE slug='pulseras';

-- Pendientes
INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Pendientes Aro Liso', 'pendientes-aro-liso', 'Aros clásicos en plata pulida de 25mm de diámetro. Cierre de presión italiano de alta seguridad. Ligeros y cómodos para uso prolongado.', 'Plata 925 · Cierre italiano', 35.00, 40, id, NULL, 2.8, '925', 'Pulido espejo', false, true FROM categories WHERE slug='pendientes';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Pendientes Lágrima Calada', 'pendientes-lagrima-calada', 'Pendientes en forma de lágrima con intrincado diseño calado en filigrana geométrica. Livianos pese a su tamaño gracias a la técnica de vaciado.', 'Plata 925 · Trabajo calado', 47.00, 25, id, NULL, 1.9, '925', 'Filigrana', false, true FROM categories WHERE slug='pendientes';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Pendientes Ear Cuff', 'pendientes-ear-cuff', 'Ear cuffs en plata que se colocan en el hélix de la oreja sin necesidad de perforación. Diseño geométrico ajustable. Se venden por unidad.', 'Plata 925 · Sin pendiente', 29.00, 60, id, 'New', 1.2, '925', 'Pulido', false, true FROM categories WHERE slug='pendientes';

-- Broches
INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Broche Nudo Celta', 'broche-nudo-celta', 'Broche decorativo con motivo de nudo celta triquetra. Cierre de presión con seguro trasero. Ideal para chales, bufandas o como broche de solapa.', 'Plata 925 · Fundición', 62.00, 20, id, NULL, 9.0, '925', 'Satinado', false, true FROM categories WHERE slug='broches';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Broche Hoja Botánico', 'broche-hoja-botanico', 'Elegante broche en forma de hoja con venas finamente grabadas. Acabado en rodio para mayor durabilidad y brillo permanente. Cierre de aguja con tope.', 'Plata 925 · Bañado rodio', 44.00, 25, id, NULL, 6.0, '925', 'Rodio', false, true FROM categories WHERE slug='broches';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Broche Mariposa Articulado', 'broche-mariposa-articulado', 'Broche mariposa con alas articuladas que se mueven sutilmente. Cuerpo en plata maciza con alas caladas. Cierre doble de seguridad.', 'Plata 925 · Articulado', 77.00, 10, id, NULL, 11.0, '925', 'Combinado', false, true FROM categories WHERE slug='broches';

-- ── Variantes de talla ─────────────────────────────────────

-- Anillo Infinito - tallas
WITH p AS (SELECT id FROM products WHERE slug='anillo-infinito')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 10, t.ord FROM p,
  (VALUES ('12',1),('13',2),('14',3),('15',4),('16',5),('17',6),('18',7),('19',8)) AS t(name,ord);

-- Anillo Sello Oval - tallas
WITH p AS (SELECT id FROM products WHERE slug='anillo-sello-oval')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 5, t.ord FROM p,
  (VALUES ('12',1),('13',2),('14',3),('15',4),('16',5),('17',6),('18',7),('19',8),('20',9)) AS t(name,ord);

-- Anillo Apilable - tallas
WITH p AS (SELECT id FROM products WHERE slug='anillo-apilable-texturizado')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 15, t.ord FROM p,
  (VALUES ('12',1),('13',2),('14',3),('15',4),('16',5),('17',6),('18',7)) AS t(name,ord);

-- Anillo Medio Dedo - tallas ajustables
WITH p AS (SELECT id FROM products WHERE slug='anillo-medio-dedo-open')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 15, t.ord FROM p,
  (VALUES ('Ajustable S',1),('Ajustable M',2),('Ajustable L',3)) AS t(name,ord);

-- Pulsera Esclava - tallas
WITH p AS (SELECT id FROM products WHERE slug='pulsera-esclava-grabada')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 8, t.ord FROM p,
  (VALUES ('XS (15cm)',1),('S (16cm)',2),('M (17cm)',3),('L (18cm)',4)) AS t(name,ord);

-- Pulsera Cadena Figaro - longitudes
WITH p AS (SELECT id FROM products WHERE slug='pulsera-cadena-figaro')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 10, t.ord FROM p,
  (VALUES ('16cm',1),('17cm',2),('18cm',3),('19cm',4),('20cm',5)) AS t(name,ord);

-- Pulsera Charm Corazón - longitudes
WITH p AS (SELECT id FROM products WHERE slug='pulsera-charm-corazon')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 10, t.ord FROM p,
  (VALUES ('16cm',1),('17cm',2),('18cm',3),('19cm',4)) AS t(name,ord);

-- Pulsera Macramé - tallas
WITH p AS (SELECT id FROM products WHERE slug='pulsera-tejida-macrame-plata')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 3, t.ord FROM p,
  (VALUES ('XS',1),('S',2),('M',3),('L',4),('XL',5)) AS t(name,ord);

-- Pendientes Aro - tamaños
WITH p AS (SELECT id FROM products WHERE slug='pendientes-aro-liso')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 15, t.ord FROM p,
  (VALUES ('25mm',1),('30mm',2),('40mm',3)) AS t(name,ord);

-- Pendientes Lágrima - tamaños
WITH p AS (SELECT id FROM products WHERE slug='pendientes-lagrima-calada')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 12, t.ord FROM p,
  (VALUES ('Pequeño',1),('Mediano',2)) AS t(name,ord);

-- Pendientes Ear Cuff - ajustable
WITH p AS (SELECT id FROM products WHERE slug='pendientes-ear-cuff')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, 'Ajustable', 60, 1 FROM p;

-- ── Usuario admin de prueba ────────────────────────────────
-- Contraseña: Admin1234! (bcrypt hash generado con cost=12)
INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
VALUES (
  'admin@plataco.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/o8nO6YtdK',
  'Admin',
  'PLATACO',
  'admin',
  true
);

-- ============================================================
-- PLATACO — Nuevos productos (ampliación de catálogo)
-- ============================================================

-- ── ANILLOS nuevos ─────────────────────────────────────────

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Anillo Banda Oro 18k', 'anillo-banda-oro-18k',
  'Banda lisa en oro amarillo 18k con acabado satinado. Pieza clásica y atemporal, trabajada a mano en oro de ley para uso diario.',
  'Oro 18k · Banda lisa', 245.00, 15, id, NULL, 4.2, '750', 'Satinado', false, true
FROM categories WHERE slug='anillos';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Anillo Eternity Circonitas', 'anillo-eternity-circonitas',
  'Circonitas blancas de talla brillante dispuestas de forma continua alrededor de la banda. Efecto eternidad con montura en pavé. Rodiado para máximo brillo.',
  'Plata 925 · Bañado en oro blanco', 155.00, 20, id, 'New', 4.8, '925', 'Rodiado', true, true
FROM categories WHERE slug='anillos';

WITH p AS (SELECT id FROM products WHERE slug='anillo-banda-oro-18k')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, t.st, t.ord FROM p,
  (VALUES ('12',3,1),('13',3,2),('14',4,3),('15',3,4),('16',2,5),('17',2,6)) AS t(name,st,ord);

WITH p AS (SELECT id FROM products WHERE slug='anillo-eternity-circonitas')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 5, t.ord FROM p,
  (VALUES ('12',1),('13',2),('14',3),('15',4),('16',5),('17',6),('18',7)) AS t(name,ord);

-- ── COLLARES nuevos ────────────────────────────────────────

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Collar Corazón Calado', 'collar-corazon-calado',
  'Colgante en forma de corazón con diseño geométrico interior calado. Muy ligero gracias a la técnica de vaciado. Cadena rolo de 42cm incluida.',
  'Plata 925 · Trabajo calado', 88.00, 25, id, NULL, 3.8, '925', 'Pulido', false, true
FROM categories WHERE slug='collares';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Collar Perla Cultivada', 'collar-perla-cultivada',
  'Perla cultivada de agua dulce de 7-8mm engarzada en colgante de plata. Cadena Singapur delicada de 40cm. Cierre mosquetón. Elegancia natural.',
  'Plata 925 · Perla cultivada', 135.00, 12, id, 'New', 4.5, '925', 'Pulido', true, true
FROM categories WHERE slug='collares';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Collar Lazo Satinado', 'collar-lazo-satinado',
  'Colgante volumétrico en forma de lazo tridimensional con acabado satinado premium. Cadena veneciana de 45cm. Pieza de autor con mucho carácter.',
  'Plata 925 · Acabado satinado', 109.00, 18, id, NULL, 5.2, '925', 'Satinado', false, true
FROM categories WHERE slug='collares';

WITH p AS (SELECT id FROM products WHERE slug='collar-corazon-calado')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 8, t.ord FROM p,
  (VALUES ('40cm',1),('45cm',2),('50cm',3)) AS t(name,ord);

WITH p AS (SELECT id FROM products WHERE slug='collar-perla-cultivada')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 6, t.ord FROM p,
  (VALUES ('40cm',1),('45cm',2)) AS t(name,ord);

WITH p AS (SELECT id FROM products WHERE slug='collar-lazo-satinado')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, 6, t.ord FROM p,
  (VALUES ('42cm',1),('45cm',2),('50cm',3)) AS t(name,ord);

-- ── PULSERAS nuevas ────────────────────────────────────────

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Pulsera Tenis Circonitas', 'pulsera-tenis-circonitas',
  'Pulsera tipo tenis con línea continua de circonitas blancas de talla brillante 2mm. Montura en pavé de cuatro garras. Cierre de caja con doble seguro.',
  'Plata 925 · Bañado rodio', 178.00, 10, id, 'New', 9.5, '925', 'Rodiado', true, true
FROM categories WHERE slug='pulseras';

WITH p AS (SELECT id FROM products WHERE slug='pulsera-tenis-circonitas')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, t.name, t.st, t.ord FROM p,
  (VALUES ('16cm',3,1),('17cm',4,2),('18cm',3,3),('19cm',2,4)) AS t(name,st,ord);

-- ── PENDIENTES nuevos ──────────────────────────────────────

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Pendientes Perla Botón', 'pendientes-perla-boton',
  'Pendientes con perla cultivada de agua dulce botón de 7mm sobre base circular de plata. Cierre de presión italiano. Clásicos y elegantes para cualquier ocasión.',
  'Plata 925 · Perla cultivada', 68.00, 20, id, NULL, 3.5, '925', 'Pulido', false, true
FROM categories WHERE slug='pendientes';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Pendientes Estrella Pavé', 'pendientes-estrella-pave',
  'Pendientes en forma de estrella de cinco puntas totalmente cuajada de micro-circonitas blancas en montaje pavé. Rodiadas para máxima durabilidad y brillo.',
  'Plata 925 · Bañado rodio', 92.00, 15, id, 'Bestseller', 4.2, '925', 'Rodiado', true, true
FROM categories WHERE slug='pendientes';

WITH p AS (SELECT id FROM products WHERE slug='pendientes-perla-boton')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, 'Par', 20, 1 FROM p;

WITH p AS (SELECT id FROM products WHERE slug='pendientes-estrella-pave')
INSERT INTO product_variants (product_id, name, stock, sort_order)
SELECT p.id, 'Par', 15, 1 FROM p;

-- ── BROCHES nuevos ─────────────────────────────────────────

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Broche Flor Art Déco', 'broche-flor-art-deco',
  'Broche floral de inspiración Art Déco con pétalos geométricos simétricos. Fundición en plata maciza. Cierre de aguja con tope de seguridad. Pieza de colección.',
  'Plata 925 · Fundición maciza', 115.00, 8, id, NULL, 8.5, '925', 'Mate', false, true
FROM categories WHERE slug='broches';

INSERT INTO products (name, slug, description, material, price_eur, stock, category_id, badge, weight_grams, purity, finish, is_featured, is_active)
SELECT 'Broche Mariposa Esmaltada', 'broche-mariposa-esmaltada',
  'Broche mariposa con alas en esmalte de colores naturales (azul y turquesa). Cuerpo central en plata maciza. Cierre de doble aguja para mayor sujeción.',
  'Plata 925 · Esmalte artesanal', 88.00, 10, id, 'New', 6.2, '925', 'Esmalte', false, true
FROM categories WHERE slug='broches';

-- ── IMÁGENES (product_images) para todos los nuevos ────────
-- Nota: cloudinary_id es temporal hasta subir fotos reales al panel de admin.
-- El frontend usará estas URLs de Unsplash como imagen principal.

WITH p AS (SELECT id FROM products WHERE slug='anillo-banda-oro-18k')
INSERT INTO product_images (product_id, cloudinary_id, url, url_thumb, url_medium, position, alt_text)
SELECT p.id, 'unsplash-anillo-banda-oro', 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&q=80', 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=200&q=80', 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&q=80', 0, 'Anillo banda oro 18k' FROM p;

WITH p AS (SELECT id FROM products WHERE slug='anillo-eternity-circonitas')
INSERT INTO product_images (product_id, cloudinary_id, url, url_thumb, url_medium, position, alt_text)
SELECT p.id, 'unsplash-anillo-eternity', 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80', 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=200&q=80', 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&q=80', 0, 'Anillo eternity circonitas' FROM p;

WITH p AS (SELECT id FROM products WHERE slug='collar-corazon-calado')
INSERT INTO product_images (product_id, cloudinary_id, url, url_thumb, url_medium, position, alt_text)
SELECT p.id, 'unsplash-collar-corazon', 'https://images.unsplash.com/photo-1596944924591-2a09b5c1c9f4?w=800&q=80', 'https://images.unsplash.com/photo-1596944924591-2a09b5c1c9f4?w=200&q=80', 'https://images.unsplash.com/photo-1596944924591-2a09b5c1c9f4?w=600&q=80', 0, 'Collar corazón calado plata' FROM p;

WITH p AS (SELECT id FROM products WHERE slug='collar-perla-cultivada')
INSERT INTO product_images (product_id, cloudinary_id, url, url_thumb, url_medium, position, alt_text)
SELECT p.id, 'unsplash-collar-perla', 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80', 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=200&q=80', 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&q=80', 0, 'Collar perla cultivada plata' FROM p;

WITH p AS (SELECT id FROM products WHERE slug='collar-lazo-satinado')
INSERT INTO product_images (product_id, cloudinary_id, url, url_thumb, url_medium, position, alt_text)
SELECT p.id, 'unsplash-collar-lazo', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=200&q=80', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80', 0, 'Collar lazo satinado plata' FROM p;

WITH p AS (SELECT id FROM products WHERE slug='pulsera-tenis-circonitas')
INSERT INTO product_images (product_id, cloudinary_id, url, url_thumb, url_medium, position, alt_text)
SELECT p.id, 'unsplash-pulsera-tenis', 'https://images.unsplash.com/photo-1588671616667-a9e65e0d4b56?w=800&q=80', 'https://images.unsplash.com/photo-1588671616667-a9e65e0d4b56?w=200&q=80', 'https://images.unsplash.com/photo-1588671616667-a9e65e0d4b56?w=600&q=80', 0, 'Pulsera tenis circonitas plata' FROM p;

WITH p AS (SELECT id FROM products WHERE slug='pendientes-perla-boton')
INSERT INTO product_images (product_id, cloudinary_id, url, url_thumb, url_medium, position, alt_text)
SELECT p.id, 'unsplash-pendientes-perla', 'https://images.unsplash.com/photo-1630018548696-e1e6e8a2ab31?w=800&q=80', 'https://images.unsplash.com/photo-1630018548696-e1e6e8a2ab31?w=200&q=80', 'https://images.unsplash.com/photo-1630018548696-e1e6e8a2ab31?w=600&q=80', 0, 'Pendientes perla botón plata' FROM p;

WITH p AS (SELECT id FROM products WHERE slug='pendientes-estrella-pave')
INSERT INTO product_images (product_id, cloudinary_id, url, url_thumb, url_medium, position, alt_text)
SELECT p.id, 'unsplash-pendientes-estrella', 'https://images.unsplash.com/photo-1599459183200-59c7687a0c70?w=800&q=80', 'https://images.unsplash.com/photo-1599459183200-59c7687a0c70?w=200&q=80', 'https://images.unsplash.com/photo-1599459183200-59c7687a0c70?w=600&q=80', 0, 'Pendientes estrella pavé plata' FROM p;

WITH p AS (SELECT id FROM products WHERE slug='broche-flor-art-deco')
INSERT INTO product_images (product_id, cloudinary_id, url, url_thumb, url_medium, position, alt_text)
SELECT p.id, 'unsplash-broche-flor', 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=80', 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=200&q=80', 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80', 0, 'Broche flor art déco plata' FROM p;

WITH p AS (SELECT id FROM products WHERE slug='broche-mariposa-esmaltada')
INSERT INTO product_images (product_id, cloudinary_id, url, url_thumb, url_medium, position, alt_text)
SELECT p.id, 'unsplash-broche-mariposa', 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=800&q=80', 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=200&q=80', 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=600&q=80', 0, 'Broche mariposa esmaltada plata' FROM p;
