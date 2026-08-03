export default async function handler(req, res) {
  // Manejar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Falta el parámetro "url"' });
  }

  try {
    const headers = {};
    // Copiar selectivamente los headers necesarios para evitar conflictos
    const headersToForward = ['authorization', 'content-type', 'accept', 'x-api-key', 'anthropic-version'];
    headersToForward.forEach(h => {
      if (req.headers[h]) {
        headers[h] = req.headers[h];
      }
    });

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);
    const dataText = await response.text();

    res.status(response.status);
    
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    res.send(dataText);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Error al conectar con el servidor destino', details: error.message });
  }
}
