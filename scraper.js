const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

// Conexión con privilegios de administrador usando GitHub Secrets
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Si dejas esta lista vacía [], el bot extraerá TODOS los perfiles a los que tenga acceso la cuenta DATAME.
const PERFILES_AGENCIA = []; /**
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

      // 2. TIME-TRAVEL PROTOCOL (Cálculo de fechas)
      const dateStart = "2026-02-01"; 
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3); 
      const dateEnd = futureDate.toISOString().split('T')[0];
      
      console.log(`\x1b[35m [WARP] Sincronizando Período: ${dateStart} -> ${dateEnd} \x1b[0m`);

      // 3. DATA EXTRACTION IN STATS
      console.log("\x1b[33m [NAVEGACIÓN] Re-direccionando a /statistics... \x1b[0m");
      await page.goto(`https://datame.cloud/statistics`);
      await page.waitForTimeout(6000);

      console.log("\x1b[33m [FILTRO] Perforando Calendario vía Script Injection... \x1b[0m");
      // Forzamos la escritura de fechas usando inyección directa al DOM
      await page.evaluate(({start, end}) => {
          const inputs = document.querySelectorAll('input[type="text"], input.q-field__native');
          if (inputs.length >= 2) {
              inputs[0].value = start;
              inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
              inputs[1].value = end;
              inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
          }
      }, { start: dateStart, end: dateEnd });

      await page.waitForTimeout(1000);
      
      console.log("\x1b[33m [BOTÓN] Disparando Clic en SHOW... \x1b[0m");
      await page.click('button:has-text("SHOW"), .q-btn:has-text("SHOW")', { timeout: 8000 }).catch(() => {});

      console.log("\x1b[36m [ESPERA] Escaneando frecuencia de Red por 15 segundos... \x1b[0m");
      await page.waitForTimeout(15000); 
      
      // Tomar evidencia visual final
      await page.screenshot({ path: 'debug.png', fullPage: true });
      console.log("\x1b[32m [SUCCESS] Transmisión de datos completada. \x1b[0m");

  } catch (err) {
      console.error("\x1b[31m [CRITICAL ERROR] Fallo en la Matrix: " + err.message + "\x1b[0m");
      await page.screenshot({ path: 'debug.png', fullPage: true }).catch(() => {});
      await browser.close();
      process.exit(1);
  }

  await browser.close();
})();