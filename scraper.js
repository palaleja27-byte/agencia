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

  // Interceptar la capa de Red (XHR) antes de que dibuje la pantalla
  page.on('response', async (response) => {
    if (response.url().includes('count-by-status-for-agency')) {
      try {
        const json = await response.json();
        
        // Sintaxis reparada: Extracción segura de datos
        const id = parseInt(json.id || json.result?.id);
        const puntos = parseFloat(json.bonuses || json.total || 0);
        const agencia = json.member || 'Agencia Operativa';

        // Filtrar y enviar a Supabase SOLO si el ID pertenece a la lista blanca, o si la lista está VACIÁ (extraer todos)
        if (PERFILES_AGENCIA.length === 0 || PERFILES_AGENCIA.includes(id)) {
          console.log(`[+] Perfil Extraído: ${id} | Puntos: ${puntos}`);
          
          await supabase.from('operaciones').upsert({
            id_perfil: id,
            agencia: agencia,
            puntos: puntos,
            fecha_corte: new Date().toISOString()
          }, { onConflict: 'id_perfil, fecha_corte' });
        }
      } catch (err) {
        // Silenciar respuestas JSON malformadas sin crashear el bot
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
      await page.click('button[type="submit"]');

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