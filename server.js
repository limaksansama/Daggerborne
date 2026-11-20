const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.static(__dirname, {
  index: 'index.html',
}));

app.use((req, res) => {
  if (req.method === 'GET' && !path.extname(req.path)) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  return res.status(404).end();
});

app.listen(PORT, HOST, () => {
  console.log(`Daggerborne listening on http://${HOST}:${PORT}`);
});
