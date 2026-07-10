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
  onProxyRes: function (proxyRes, req, res) {
    // Eliminar el header WWW-Authenticate de Kong para evitar el popup de Iniciar Sesion en el navegador
    if (proxyRes.headers['www-authenticate']) {
      delete proxyRes.headers['www-authenticate'];
    }
  }
});

// Enrutar endpoints específicos de Supabase al proxy
app.use('/rest', supabaseProxy);
app.use('/realtime', supabaseProxy);
app.use('/auth', supabaseProxy);
app.use('/storage', supabaseProxy);
app.use('/graphql', supabaseProxy);

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
