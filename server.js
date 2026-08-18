require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;
const REBRICKABLE_API_KEY = process.env.REBRICKABLE_API_KEY;
const REBRICKABLE_BASE_URL = 'https://rebrickable.com';

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

async function proxyRebrickableUrl(req, res, url) {
  if (!REBRICKABLE_API_KEY) {
    return res.status(500).json({
      error: 'Missing REBRICKABLE_API_KEY on the server.',
    });
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `key ${REBRICKABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    return res.status(502).json({
      error: 'Error contacting Rebrickable.',
      details: error.message,
    });
  }
}



app.get('/api/minifigs', async (req, res) => {
  const search = req.query.search || '';
  const pageSize = req.query.page_size || '50';
  const page = req.query.page || '1';
  
  const url = new URL('/api/v3/lego/minifigs/', REBRICKABLE_BASE_URL);
  url.searchParams.set('search', search);
  url.searchParams.set('page_size', pageSize);
  url.searchParams.set('page', page);

  return proxyRebrickableUrl(req, res, url);
});

app.get('/api/minifig-sets/:setNum', async (req, res) => {
  const { setNum } = req.params;
  const url = new URL(`/api/v3/lego/minifigs/${encodeURIComponent(setNum)}/sets/`, REBRICKABLE_BASE_URL);
  url.searchParams.set('page_size', '20');

  return proxyRebrickableUrl(req, res, url);
});

app.get('/api/set-detail/:setNum', async (req, res) => {
  const { setNum } = req.params;
  const url = new URL(`/api/v3/lego/sets/${encodeURIComponent(setNum)}/`, REBRICKABLE_BASE_URL);

  return proxyRebrickableUrl(req, res, url);
});

app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'server running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
