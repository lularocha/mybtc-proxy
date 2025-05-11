const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for your calculator’s domain
app.use(cors({
  origin: ['https://your-calculator-domain.com', 'http://localhost:8000'], // Replace with your Hostinger domain
  methods: ['GET'],
  allowedHeaders: ['Content-Type']
}));

// Cache to store prices and reduce API calls
const cache = {
  btcusdt: { price: null, timestamp: 0 },
  usdtbrl: { price: null, timestamp: 0 },
  earliest: { price: null, timestamp: 0 },
  historical: { prices: {}, timestamp: 0 }
};
const CACHE_DURATION = 10 * 1000; // Cache for 10 seconds

// Helper function to fetch Binance price

async function fetchBinancePrice(symbol) {
  try {
    const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124'
      }
    });
    return parseFloat(response.data.price);
  } catch (error) {
    console.error(`Error fetching ${symbol} price:`, error.message, error.response ? error.response.data : '');
    throw error;
  }
}

async function fetchEarliestBitcoinPrice() {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=0&limit=1', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124'
      }
    });
    return response.data.length > 0 ? { price: parseFloat(response.data[0][4]), timestamp: response.data[0][0] } : null;
  } catch (error) {
    console.error('Error fetching earliest price:', error.message, error.response ? error.response.data : '');
    throw error;
  }
}

async function fetchHistoricalBitcoinPrice(period, pastTimestamp) {
  const interval = ['1D', '1W', '1M'].includes(period) ? '1h' : '1d';
  try {
    const response = await axios.get(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&endTime=${pastTimestamp}&limit=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124'
      }
    });
    return response.data.length > 0 ? parseFloat(response.data[0][4]) : null;
  } catch (error) {
    console.error(`Error fetching historical price for ${period}:`, error.message, error.response ? error.response.data : '');
    throw error;
  }
}

// Endpoint for current prices (BTCUSDT and USDTBRL)
app.get('/api/prices', async (req, res) => {
  const now = Date.now();
  try {
    // Check cache for BTCUSDT
    if (!cache.btcusdt.price || now - cache.btcusdt.timestamp > CACHE_DURATION) {
      cache.btcusdt.price = await fetchBinancePrice('BTCUSDT');
      cache.btcusdt.timestamp = now;
    }
    // Check cache for USDTBRL
    if (!cache.usdtbrl.price || now - cache.usdtbrl.timestamp > CACHE_DURATION) {
      cache.usdtbrl.price = await fetchBinancePrice('USDTBRL');
      cache.usdtbrl.timestamp = now;
    }
    res.json({
      btcusdt: cache.btcusdt.price,
      usdtbrl: cache.usdtbrl.price
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// Endpoint for earliest Bitcoin price
app.get('/api/earliest-price', async (req, res) => {
  const now = Date.now();
  try {
    if (!cache.earliest.price || now - cache.earliest.timestamp > CACHE_DURATION) {
      const data = await fetchEarliestBitcoinPrice();
      cache.earliest = data || { price: null, timestamp: 0 };
      cache.earliest.timestamp = now;
    }
    res.json(cache.earliest);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch earliest price' });
  }
});

// Endpoint for historical Bitcoin price
app.get('/api/historical-price', async (req, res) => {
  const { period, timestamp } = req.query;
  const now = Date.now();
  try {
    if (!cache.historical.prices[period] || now - cache.historical.timestamp > CACHE_DURATION) {
      const price = await fetchHistoricalBitcoinPrice(period, parseInt(timestamp));
      cache.historical.prices[period] = price;
      cache.historical.timestamp = now;
    }
    res.json({ price: cache.historical.prices[period] });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch historical price for ${period}` });
  }
});

app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});