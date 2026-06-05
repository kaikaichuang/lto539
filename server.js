const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let cachedData = null;
let cacheTime = 0;
const CACHE_DURATION = 30 * 60 * 1000;

app.use(express.static(path.join(__dirname, 'public')));

function parseDrawsFromHtml(html) {
  const $ = cheerio.load(html);
  const draws = [];

  $('table.dynamic-table tr').each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 2) {
      const dateText = $(cells[0]).text().trim();
      const numbersText = $(cells[1]).text().trim();
      const numbers = numbersText.match(/\d+/g);
      if (numbers && numbers.length === 5 && dateText && /\d/.test(dateText)) {
        draws.push({
          period: `${draws.length + 1}`,
          date: dateText,
          numbers: numbers.map(Number)
        });
      }
    }
  });

  return draws;
}

async function fetchPage(pageNum) {
  const url = 'https://www.pilio.idv.tw/lto539/list.asp';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  if (pageNum <= 1) {
    const response = await axios.get(url, { headers, timeout: 15000 });
    return response.data;
  }

  const response = await axios.post(url, `indexpage=${pageNum}`, {
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000
  });
  return response.data;
}

app.get('/api/lottery', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedData && (now - cacheTime) < CACHE_DURATION) {
      return res.json({ success: true, data: cachedData });
    }

    const [html1, html2] = await Promise.all([
      fetchPage(1),
      fetchPage(2)
    ]);

    const draws1 = parseDrawsFromHtml(html1);
    const draws2 = parseDrawsFromHtml(html2);

    const allDraws = [...draws1, ...draws2];

    allDraws.forEach((d, i) => {
      d.period = String(i + 1);
    });

    const recent45 = allDraws.slice(0, 45);

    if (recent45.length === 0) {
      return res.json({
        success: false,
        error: '無法解析開獎資料，網站結構可能已變更'
      });
    }

    cachedData = recent45;
    cacheTime = now;

    res.json({ success: true, data: recent45, total: recent45.length });
  } catch (error) {
    console.error('Scraping error:', error.message);
    res.status(500).json({
      success: false,
      error: '無法取得開獎資料: ' + error.message
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
