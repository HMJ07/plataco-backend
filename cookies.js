/**
 * PLATACO — Cookie Consent Banner
 * Incluye: análisis (Google Analytics), marketing y funcionales.
 * Guarda preferencias en localStorage durante 365 días.
 *
 * USO: Añade <script src="cookies.js"></script> antes de </body> en cada página.
 * Para Google Analytics activa window.PLATACO_GA_ID antes de incluir este script:
 *   <script>window.PLATACO_GA_ID = 'G-XXXXXXXXXX';</script>
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'plataco_cookie_consent';
  const EXPIRY_DAYS = 365;

  // ── Helpers ─────────────────────────────────────────────
  function getConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() > data.expires) { localStorage.removeItem(STORAGE_KEY); return null; }
      return data;
    } catch { return null; }
  }

  function saveConsent(analytics, marketing) {
    const data = {
      analytics,
      marketing,
      functional: true, // siempre activas
      date: new Date().toISOString(),
      expires: Date.now() + EXPIRY_DAYS * 86400000,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    applyConsent(data);
  }

  function applyConsent(data) {
    // Activa Google Analytics si está configurado y el usuario aceptó analytics
    if (data.analytics && window.PLATACO_GA_ID) {
      loadGA(window.PLATACO_GA_ID);
    }
    // Aquí puedes añadir más scripts de terceros condicionados a data.marketing
    window.dispatchEvent(new CustomEvent('plataco:consent', { detail: data }));
  }

  function loadGA(id) {
    if (window._gaLoaded) return;
    window._gaLoaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', id);
  }

  // ── CSS ─────────────────────────────────────────────────
  const css = `
  #plataco-cookie-banner *{box-sizing:border-box;margin:0;padding:0;}
  #plataco-cookie-banner{
    position:fixed;bottom:0;left:0;right:0;z-index:99999;
    font-family:'Jost','Helvetica Neue',Arial,sans-serif;
    background:#0d0d0d;border-top:1px solid #1e1e1e;
    padding:1.6rem 2rem;
    transform:translateY(100%);
    transition:transform 0.45s cubic-bezier(0.22,1,0.36,1);
    box-shadow:0 -8px 40px rgba(0,0,0,0.6);
  }
  #plataco-cookie-banner.visible{transform:translateY(0);}
  .cookie-inner{
    max-width:1200px;margin:0 auto;
    display:flex;align-items:center;gap:2rem;flex-wrap:wrap;
  }
  .cookie-text{flex:1;min-width:260px;}
  .cookie-title{
    font-size:0.72rem;letter-spacing:0.3em;text-transform:uppercase;
    color:#C9A84C;margin-bottom:0.35rem;
  }
  .cookie-desc{
    font-size:0.78rem;color:#555;line-height:1.7;
  }
  .cookie-desc a{color:#C9A84C;text-decoration:none;}
  .cookie-desc a:hover{text-decoration:underline;}
  .cookie-toggles{
    display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap;
  }
  .toggle-item{display:flex;align-items:center;gap:0.5rem;cursor:pointer;}
  .toggle-item input[type=checkbox]{
    appearance:none;-webkit-appearance:none;
    width:32px;height:18px;border-radius:9px;
    background:#1a1a1a;border:1px solid #2a2a2a;
    position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;
  }
  .toggle-item input[type=checkbox]:checked{background:#C9A84C;border-color:#C9A84C;}
  .toggle-item input[type=checkbox]::after{
    content:'';position:absolute;top:2px;left:2px;
    width:12px;height:12px;border-radius:50%;background:white;
    transition:left 0.2s;
  }
  .toggle-item input[type=checkbox]:checked::after{left:16px;}
  .toggle-item input[type=checkbox]:disabled{opacity:0.4;cursor:not-allowed;}
  .toggle-label{font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:#444;}
  .cookie-actions{display:flex;gap:0.7rem;flex-wrap:wrap;}
  .cookie-btn{
    font-family:'Jost','Helvetica Neue',Arial,sans-serif;
    font-size:0.65rem;letter-spacing:0.25em;text-transform:uppercase;
    padding:0.65rem 1.4rem;cursor:pointer;border:none;
    transition:opacity 0.2s;white-space:nowrap;
  }
  .cookie-btn-accept{background:#C9A84C;color:#0a0a0a;}
  .cookie-btn-accept:hover{opacity:0.85;}
  .cookie-btn-save{background:none;color:#555;border:1px solid #1e1e1e;}
  .cookie-btn-save:hover{color:#aaa;border-color:#333;}
  .cookie-btn-reject{background:none;color:#333;border:1px solid #111;}
  .cookie-btn-reject:hover{color:#555;}

  /* Panel de ajustes */
  #plataco-cookie-modal{
    display:none;position:fixed;inset:0;z-index:100000;
    background:rgba(0,0,0,0.85);backdrop-filter:blur(4px);
    align-items:center;justify-content:center;padding:1.5rem;
  }
  #plataco-cookie-modal.open{display:flex;}
  .modal-box{
    background:#111;border:1px solid #1e1e1e;max-width:560px;width:100%;
    max-height:90vh;overflow-y:auto;
  }
  .modal-header{
    padding:2rem 2rem 1rem;border-bottom:1px solid #1a1a1a;
    display:flex;align-items:center;justify-content:space-between;
  }
  .modal-logo{font-family:'Cormorant Garamond',Georgia,serif;font-size:1rem;letter-spacing:0.3em;color:#C9A84C;font-weight:300;}
  .modal-close{background:none;border:none;color:#333;font-size:1.2rem;cursor:pointer;transition:color 0.2s;}
  .modal-close:hover{color:white;}
  .modal-body{padding:1.5rem 2rem;}
  .modal-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.4rem;font-weight:300;color:white;margin-bottom:0.4rem;}
  .modal-intro{font-size:0.78rem;color:#444;line-height:1.7;margin-bottom:1.5rem;}
  .cookie-category{border:1px solid #1a1a1a;margin-bottom:0.8rem;}
  .cat-header{
    padding:1rem 1.2rem;display:flex;align-items:center;justify-content:space-between;
    cursor:pointer;user-select:none;
  }
  .cat-header:hover{background:#0f0f0f;}
  .cat-name{font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:#888;}
  .cat-toggle{display:flex;align-items:center;gap:0.6rem;}
  .cat-badge{font-size:0.58rem;letter-spacing:0.15em;text-transform:uppercase;color:#444;}
  .cat-body{padding:0 1.2rem 1.2rem;font-size:0.78rem;color:#444;line-height:1.7;display:none;}
  .cat-body.open{display:block;}
  .modal-footer{padding:1.2rem 2rem 1.5rem;border-top:1px solid #1a1a1a;display:flex;gap:0.7rem;justify-content:flex-end;flex-wrap:wrap;}
  `;

  // ── HTML ─────────────────────────────────────────────────
  const html = `
  <div id="plataco-cookie-banner" role="dialog" aria-label="Política de cookies">
    <div class="cookie-inner">
      <div class="cookie-text">
        <p class="cookie-title">✦ Cookies</p>
        <p class="cookie-desc">
          Usamos cookies propias y de terceros para mejorar tu experiencia y mostrarte contenido relevante.
          Puedes aceptarlas todas o personalizar tu elección.
          <a href="politica-privacidad.html">Más información</a>.
        </p>
      </div>
      <div class="cookie-toggles">
        <label class="toggle-item" title="Siempre activas">
          <input type="checkbox" id="ck-functional" checked disabled>
          <span class="toggle-label">Funcionales</span>
        </label>
        <label class="toggle-item">
          <input type="checkbox" id="ck-analytics">
          <span class="toggle-label">Análisis</span>
        </label>
        <label class="toggle-item">
          <input type="checkbox" id="ck-marketing">
          <span class="toggle-label">Marketing</span>
        </label>
      </div>
      <div class="cookie-actions">
        <button class="cookie-btn cookie-btn-reject" onclick="platacoCookies.reject()">Rechazar todo</button>
        <button class="cookie-btn cookie-btn-save" onclick="platacoCookies.openModal()">Personalizar</button>
        <button class="cookie-btn cookie-btn-accept" onclick="platacoCookies.acceptAll()">Aceptar todo</button>
      </div>
    </div>
  </div>

  <div id="plataco-cookie-modal" role="dialog" aria-modal="true" aria-label="Configuración de cookies">
    <div class="modal-box">
      <div class="modal-header">
        <span class="modal-logo">PLATA&amp;CO</span>
        <button class="modal-close" onclick="platacoCookies.closeModal()" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">
        <h2 class="modal-title">Configuración de cookies</h2>
        <p class="modal-intro">
          Puedes activar o desactivar cada categoría. Las cookies estrictamente necesarias no pueden desactivarse
          ya que son imprescindibles para el funcionamiento de la web.
        </p>

        <div class="cookie-category">
          <div class="cat-header" onclick="platacoCookies.toggleCat('cat-necesarias')">
            <span class="cat-name">Estrictamente necesarias</span>
            <div class="cat-toggle">
              <span class="cat-badge">Siempre activas</span>
            </div>
          </div>
          <div class="cat-body" id="cat-necesarias">
            Estas cookies son imprescindibles para que la web funcione correctamente. Incluyen la gestión de sesión, carrito de compra y preferencias básicas. No pueden desactivarse.
          </div>
        </div>

        <div class="cookie-category">
          <div class="cat-header" onclick="platacoCookies.toggleCat('cat-analiticas')">
            <span class="cat-name">Analíticas</span>
            <div class="cat-toggle">
              <input type="checkbox" id="modal-ck-analytics" style="width:32px;height:18px;border-radius:9px;background:#1a1a1a;border:1px solid #2a2a2a;position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;appearance:none;-webkit-appearance:none;" onclick="event.stopPropagation()">
            </div>
          </div>
          <div class="cat-body" id="cat-analiticas">
            Nos ayudan a entender cómo interactúan los visitantes con nuestra web (páginas más visitadas, tiempo de permanencia, errores). Usamos Google Analytics con IP anonimizada. Los datos son agregados y anónimos.
          </div>
        </div>

        <div class="cookie-category">
          <div class="cat-header" onclick="platacoCookies.toggleCat('cat-marketing')">
            <span class="cat-name">Marketing y publicidad</span>
            <div class="cat-toggle">
              <input type="checkbox" id="modal-ck-marketing" style="width:32px;height:18px;border-radius:9px;background:#1a1a1a;border:1px solid #2a2a2a;position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;appearance:none;-webkit-appearance:none;" onclick="event.stopPropagation()">
            </div>
          </div>
          <div class="cat-body" id="cat-marketing">
            Permiten mostrar anuncios personalizados en redes sociales y otras plataformas basados en tu historial de navegación. Si las desactivas, seguirás viendo anuncios pero no personalizados.
          </div>
        </div>

      </div>
      <div class="modal-footer">
        <button class="cookie-btn cookie-btn-reject" onclick="platacoCookies.rejectFromModal()">Rechazar todo</button>
        <button class="cookie-btn cookie-btn-accept" onclick="platacoCookies.saveFromModal()">Guardar preferencias</button>
      </div>
    </div>
  </div>
  `;

  // ── Init ─────────────────────────────────────────────────
  function init() {
    // Inject CSS
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // Inject HTML
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);

    // Sync modal checkboxes styles
    syncCheckboxStyle('modal-ck-analytics');
    syncCheckboxStyle('modal-ck-marketing');
    document.getElementById('modal-ck-analytics').addEventListener('change', () => syncCheckboxStyle('modal-ck-analytics'));
    document.getElementById('modal-ck-marketing').addEventListener('change', () => syncCheckboxStyle('modal-ck-marketing'));

    // Check existing consent
    const existing = getConsent();
    if (existing) {
      applyConsent(existing);
    } else {
      // Show banner after slight delay
      setTimeout(() => {
        document.getElementById('plataco-cookie-banner').classList.add('visible');
      }, 800);
    }
  }

  function syncCheckboxStyle(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.checked) {
      el.style.background = '#C9A84C';
      el.style.borderColor = '#C9A84C';
    } else {
      el.style.background = '#1a1a1a';
      el.style.borderColor = '#2a2a2a';
    }
  }

  function hideBanner() {
    const b = document.getElementById('plataco-cookie-banner');
    if (b) { b.style.transform = 'translateY(100%)'; }
  }

  // ── Public API ───────────────────────────────────────────
  window.platacoCookies = {
    acceptAll() {
      saveConsent(true, true);
      hideBanner();
    },
    reject() {
      saveConsent(false, false);
      hideBanner();
    },
    openModal() {
      const existing = getConsent();
      if (existing) {
        document.getElementById('modal-ck-analytics').checked = !!existing.analytics;
        document.getElementById('modal-ck-marketing').checked = !!existing.marketing;
      }
      syncCheckboxStyle('modal-ck-analytics');
      syncCheckboxStyle('modal-ck-marketing');
      document.getElementById('plataco-cookie-modal').classList.add('open');
    },
    closeModal() {
      document.getElementById('plataco-cookie-modal').classList.remove('open');
    },
    saveFromModal() {
      const analytics = document.getElementById('modal-ck-analytics').checked;
      const marketing = document.getElementById('modal-ck-marketing').checked;
      saveConsent(analytics, marketing);
      this.closeModal();
      hideBanner();
    },
    rejectFromModal() {
      saveConsent(false, false);
      this.closeModal();
      hideBanner();
    },
    toggleCat(id) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('open');
    },
    // Para mostrar el banner de nuevo (p.ej. desde el pie de página)
    showPreferences() {
      this.openModal();
    },
    getConsent,
  };

  // Close modal on backdrop click
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('plataco-cookie-modal');
    if (modal && e.target === modal) {
      modal.classList.remove('open');
    }
  });

  // ── Run ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
