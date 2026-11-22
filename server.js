const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.static(__dirname, {
  index: 'index.html',
}));

app.use((req, res) => {
  /* Repli SPA réservé aux navigations HTML : une URL inconnue demandée par
     fetch() (en-tête Accept générique) ne reçoit plus index.html. */
  const wantsHtml = req.method === 'GET'
    && !path.extname(req.path)
    && (req.get('accept') || '').includes('text/html');
  if (wantsHtml) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  return res.status(404).end();
});

app.listen(PORT, HOST, () => {
  console.log(`Daggerborne listening on http://${HOST}:${PORT}`);
});
