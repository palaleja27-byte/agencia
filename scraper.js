const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

// Conexión con privilegios de administrador usando GitHub Secrets
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 🚀 LISTA DE IDs FILTRADA (Basada en la imagen de Datame para pruebas)
const PERFILES_AGENCIA = [
  95956014,  // PABLO
  91733663,  // DANIEL (DANIEL 68)
  138130329, // AGUSTIN
  144863124, // FERNANDO
  95955130,  // HECTOR
  98389135,  // RAUL
  98540781,  // LEANDRO
  103291980, // ARMANDO
  130431310, // RAFAEL
  143014129  // RENEE
  // VALQUIMAR y LUIS DAROSA (Pendientes de ID para agregar)
]; 
/**
 * ⚡ CYBER-SCRAPE PROTOCOL 2026 ⚡
 * Agencia RR: Infiltración Temporal Activada
 */
(async () => {
  console.log("\n\x1b[36m [SYSTEM] INICIANDO SECUENCIA DE INFILTRACIÓN CYBERPUNK... \x1b[0m");
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage(); // 🛰️ RADAR XHR MULTI-CAPA (Radar de Red)
  page.on('response', async (response) => {
    const resUrl = response.url();
    if (response.request().resourceType() === 'fetch' || response.request().resourceType() === 'xhr') {
      try {
        const json = await response.json();
        let dataList = Array.isArray(json) ? json : (json.data || json.result || [json]);
        if (!Array.isArray(dataList)) dataList = [dataList];

        for (const item of dataList) {
          // Buscamos ID y Puntos en cualquier propiedad posible (Fuerza Bruta)
          const id = parseInt(item.id || item.profile_id || item.user_id || item.ID);
          
          // --- LIMPIEZA DE DIVISAS (6 776.34$ -> 6776.34) ---
          const rawPuntos = item.bonuses || item.total || item.points || item.amount || 0;
          const cleanPuntos = String(rawPuntos).replace(/[^\d.]/g, ''); // Solo dígitos y puntos
          const puntos = parseFloat(cleanPuntos);
          
          const agencia = item.member || item.agency || 'Agencia RR';

          if (id && !isNaN(id) && puntos > 0) {
            console.log(`\x1b[32m [✓] EXTRAÍDO: ID ${id} | SCORE: ${puntos} | AGENCIA: ${agencia} \x1b[0m`);
            
            await supabase.from('operaciones').upsert({
              id_perfil: id,
              agencia: agencia,
              puntos: puntos,
              fecha_corte: new Date().toISOString()
            }, { onConflict: 'id_perfil, fecha_corte' });
          }
        }
      } catch (e) {} 
    }
  });

  try {
      // 1. LOGIN PROTOCOL
      console.log("\x1b[33m [LINK] Accediendo a la Terminal Central... \x1b[0m");
      await page.goto('https://datame.cloud/login');

      if (!process.env.DATAME_USERNAME || !process.env.DATAME_PASSWORD) {
          console.error("❌ ERROR: CREDENCIALES NO ENCONTRADAS EN LA MATRIZ.");
          process.exit(1);
      }

      const userSelector = 'input[type="text"], input[type="email"], input[name="username"]';
      await page.waitForSelector(userSelector, { timeout: 15000 });
      await page.type(userSelector, process.env.DATAME_USERNAME, { delay: 50 });
      await page.type('input[type="password"]', process.env.DATAME_PASSWORD, { delay: 50 });
      
      console.log("\x1b[36m [AUTH] Ejecutando Handshake... \x1b[0m");
      await page.click('button.q-btn, button:has-text("LOG IN"), .q-btn__content', { timeout: 8000 })
                .catch(() => page.press('input[type="password"]', 'Enter'));

      await page.waitForTimeout(6000);

      // 2. TIME-TRAVEL PROTOCOL (Cálculo de fechas - MES ACTUAL ÚNICAMENTE)
      const now = new Date();
      const dateStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; 
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3); 
      const dateEnd = futureDate.toISOString().split('T')[0];
      
      console.log(`\x1b[35m [WARP] Sincronizando Período: ${dateStart} -> ${dateEnd} \x1b[0m`);

      // 3. DATA EXTRACTION IN STATS
      console.log("\x1b[33m [NAVEGACIÓN] Re-direccionando a /statistics... \x1b[0m");
      await page.goto(`https://datame.cloud/statistics`);
      await page.waitForTimeout(6000);

      console.log("\x1b[33m [FILTRO] Inyectando Fechas de Búsqueda... \x1b[0m");
      await page.evaluate(({start, end}) => {
          const inputs = document.querySelectorAll('input[type="text"], input.q-field__native');
          if (inputs.length >= 2) {
              inputs[0].value = start;
              inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
              inputs[1].value = end;
              inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
          }
      }, { start: dateStart, end: dateEnd });

      await page.waitForTimeout(1500);
      
      const perfilesABuscar = PERFILES_AGENCIA.length > 0 ? PERFILES_AGENCIA : [''];

      for (let i = 0; i < perfilesABuscar.length; i++) {
        const idPerfil = String(perfilesABuscar[i]);
        console.log(`\n\x1b[35m [SCAN] Analizando Perfil ${i+1}/${perfilesABuscar.length}: [${idPerfil}] \x1b[0m`);

        if (idPerfil !== '') {
          try {
            await page.evaluate((idValue) => {
              const allInputs = Array.from(document.querySelectorAll('input'));
              let targetInput = allInputs.find(i => 
                (i.getAttribute('aria-label') || '').toLowerCase().includes('profile') || 
                (i.placeholder || '').toLowerCase().includes('profile') ||
                (i.closest('label') && i.closest('label').innerText.toLowerCase().includes('profile'))
              );
              
              if (!targetInput && allInputs.length >= 3) {
                  targetInput = allInputs[2];
              }

              if (targetInput) {
                  targetInput.value = idValue;
                  targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                  targetInput.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, idPerfil);
          } catch (e) {
            console.error("\x1b[31m [WARN] No se pudo escribir en la casilla Member's profile \x1b[0m", e);
          }
          await page.waitForTimeout(800);
        }

        // Disparamos el clic en el botón SHOW
        await page.click('button:has-text("SHOW"), .q-btn:has-text("SHOW")', { timeout: 8000 }).catch(() => {});
        
        // Esperamos para que la red responda el XHR de este perfil
        await page.waitForTimeout(4000);
      }

      console.log("\x1b[36m [ESPERA FINAL] Cierre de red... \x1b[0m");
      await page.waitForTimeout(3000); 
      
      // Tomar evidencia visual final
      await page.screenshot({ path: 'debug.png', fullPage: true });
      console.log("\x1b[32m [SUCCESS] Transmisión de datos iterativa completada. \x1b[0m");

  } catch (err) {
      console.error("\x1b[31m [CRITICAL ERROR] Fallo en la Matrix: " + err.message + "\x1b[0m");
      await page.screenshot({ path: 'debug.png', fullPage: true }).catch(() => {});
      await browser.close();
      process.exit(1);
  }

  await browser.close();
})();