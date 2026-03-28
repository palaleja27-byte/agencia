const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

// Conexión con privilegios de administrador usando GitHub Secrets
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Si dejas esta lista vacía [], el bot extraerá TODOS los perfiles a los que tenga acceso la cuenta DATAME.
const PERFILES_AGENCIA = []; 

(async () => {
  console.log("Iniciando infiltración a la red de Datame...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Interceptar la capa de Red (XHR)
  page.on('response', async (response) => {
    if (response.request().resourceType() === 'fetch' || response.request().resourceType() === 'xhr') {
      const url = response.url();
      console.log(`[RED] Cargando: ${url}`);
      
      try {
        const json = await response.json();
        
        // Convertimos a array por si Datame manda todos los perfiles en un solo golpe (array) o dentro de "data"
        let dataList = [];
        if (Array.isArray(json)) dataList = json;
        else if (Array.isArray(json.data)) dataList = json.data;
        else if (Array.isArray(json.result)) dataList = json.result;
        else dataList = [json]; // o es un objeto simple

        for (const item of dataList) {
           const id = parseInt(item.id || item.profile_id || item.user_id);
           if (id && !isNaN(id)) {
               const puntos = parseFloat(item.bonuses || item.total || item.points || 0);
               const agencia = item.member || item.agency || 'Agencia Operativa';

               if (PERFILES_AGENCIA.length === 0 || PERFILES_AGENCIA.includes(id)) {
                 console.log(`[+++] ¡BINGO! Perfil: ${id} | Puntos: ${puntos}`);
                 
                 await supabase.from('operaciones').upsert({
                   id_perfil: id,
                   agencia: agencia,
                   puntos: puntos,
                   fecha_corte: new Date().toISOString()
                 }, { onConflict: 'id_perfil, fecha_corte' });
               }
           }
        }
      } catch (err) {
        // Ignoramos respuestas que no son JSON validos (como archivos vacios)
      }
    }
  });

  // Autenticación Autónoma
  try {
      await page.goto('https://datame.cloud/statistics');
      
      // Intentar múltiples selectores por si Datame lo cambió a "email" en su diseño
      const inputUsuario = 'input[type="text"], input[type="email"], input[name="username"]';
      // Validación anti-errores
      if (!process.env.DATAME_USERNAME || !process.env.DATAME_PASSWORD) {
          console.error("❌ ERROR GIGANTE: Las credenciales DATAME_USERNAME o DATAME_PASSWORD están VACÍAS. Por favor verifica tus Secrets de GitHub.");
          process.exit(1);
      }

      await page.waitForSelector(inputUsuario, { timeout: 15000 });
      
      console.log("[NAVEGADOR] Escribiendo credenciales modo humano...");
      // Escribir letra por letra para disparar eventos de validación del sitio
      await page.type(inputUsuario, process.env.DATAME_USERNAME, { delay: 100 });
      await page.type('input[type="password"]', process.env.DATAME_PASSWORD, { delay: 100 });
      
      console.log("[NAVEGADOR] Buscando botón de acceso azul...");
      // Probamos el selector de clase de Quasar que suele usar Datame (.q-btn) o el texto
      const loginBtn = 'button.q-btn, button:has-text("LOG IN"), .q-btn__content';
      
      try { 
          await page.click(loginBtn, { timeout: 5000 }); 
      } catch(e) {
          console.log("[NAVEGADOR] Falló clic especializado, intentando Enter...");
          await page.press('input[type="password"]', 'Enter');
      }

      // Esperar la navegación o el cambio de estado
      await page.waitForTimeout(8000); 
      
      const currentUrl = page.url();
      console.log(`[NAVEGADOR] URL actual tras login: ${currentUrl}`);
      
      if (currentUrl.includes('login') || currentUrl.includes('logout')) {
          console.log("⚠️ Seguimos en login/logout. Revisando errores en pantalla...");
      } else {
          console.log("✅ ¡Parece que entramos! Navegando a sección de datos...");
          await page.goto('https://datame.cloud/members').catch(() => {});
          await page.waitForTimeout(5000);
      }
      
      console.log("[DEBUG] Tomando captura de pantalla de la situación actual...");
      await page.screenshot({ path: 'debug.png', fullPage: true });
      console.log("[DEBUG] Captura guardada como debug.png");
      
  } catch (err) {
      console.error("ERROR CRÍTICO:", err.message);
      await page.screenshot({ path: 'debug.png', fullPage: true }).catch(() => {});
      await browser.close();
      process.exit(1);
  }

  // Desconectando
  await browser.close();
  console.log("Operación completada. Desconectando.");
})();