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
      await page.waitForSelector(inputUsuario, { timeout: 15000 });
      await page.fill(inputUsuario, process.env.DATAME_USERNAME);
      await page.fill('input[type="password"]', process.env.DATAME_PASSWORD);
      
      // Estrategia Universal: Presionar Enter dentro de la clave (casi siempre envía el formulario)
      await page.press('input[type="password"]', 'Enter');
      
      // Respaldo de click por si no reacciona al Enter (Botones clásicos de Login)
      try { await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")', { timeout: 3000 }); } catch(e) {}

      await page.waitForTimeout(5000); 
      
      try {
         // Forzar la recarga visual en Datame para activar el XHR
         await page.click('button:has-text("SHOW")');
         await page.waitForTimeout(5000); 
      } catch(e) {
         console.log("Advertencia: No se detectó botón SHOW.");
      }
  } catch (err) {
      console.error("ERROR CRÍTICO AL LOGUEARSE:", err.message);
      console.log("\n--- EXTRACCIÓN DEL HTML PARA DIAGNÓSTICO ---");
      const pageHtml = await page.innerHTML('body'); // Leemos la página para saber si Datame bloqueó al robot
      console.log(pageHtml.substring(0, 2000));
      console.log("--------------------------------------------\n");
      await browser.close();
      process.exit(1);
  }

  // Se eliminó la invocación al RPC ya que ahora el dashboard escucha directamente postgres_changes

  await browser.close();
  console.log("Operación completada. Desconectando.");
})();