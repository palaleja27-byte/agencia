const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 8080;

// Configurar el proxy para enrutar las llamadas de Supabase al puerto 8000 local
const supabaseProxy = createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true,
  ws: true, // Habilitar WebSockets para Supabase Realtime
  logLevel: 'info',
  pathFilter: (pathname, req) => {
    return pathname.match(/^\/(rest|realtime|auth|storage|graphql)/);
  },
  onProxyRes: function (proxyRes, req, res) {
    if (proxyRes.headers['www-authenticate']) {
      delete proxyRes.headers['www-authenticate'];
    }
  }
});

// Ruta de emergencia para recuperar las llaves de Supabase
app.get('/debug-keys', (req, res) => {
  const fs = require('fs');
  const paths = [
    '../supabase/docker/.env',
    './supabase/docker/.env',
    '../../supabase/docker/.env',
    '../supabase/.env',
    './supabase/.env'
  ];
  
  for (let p of paths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const anonMatch = content.match(/ANON_KEY=(.*)/);
        const serviceMatch = content.match(/SERVICE_ROLE_KEY=(.*)/);
        if (anonMatch || serviceMatch) {
          return res.send(`
            <h1>Llaves Encontradas en ${p}</h1>
            <p><b>ANON_KEY:</b> ${anonMatch ? anonMatch[1] : 'No encontrada'}</p>
            <p><b>SERVICE_ROLE_KEY:</b> ${serviceMatch ? serviceMatch[1] : 'No encontrada'}</p>
          `);
        }
      }
    } catch (e) {}
  }
  res.send('<h1>No se encontraron las llaves en las rutas comunes.</h1>');
});

// Enrutar endpoints específicos de Supabase al proxy usando el middleware globalmente
app.use(supabaseProxy);

// Servir los archivos estáticos (index.html, scripts.js, etc) del directorio actual
app.use(express.static(path.join(__dirname, '.')));

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 SERVIDOR ALL-IN-ONE INICIADO`);
  console.log(`🌐 Frontend sirviéndose en el puerto ${PORT}`);
  console.log(`🔀 Proxy conectado a Supabase en puerto 8000`);
  console.log(`=========================================`);
  console.log(`Para exponer este servidor a internet, corre:`);
  console.log(`ngrok http 8080`);
});
