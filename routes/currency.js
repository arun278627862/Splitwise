const express = require('express');
const axios = require('axios');
const auth = require('../middleware/auth');

const router = express.Router();

// In-memory cache for exchange rates (in production, consider using Redis)
let exchangeRateCache = {
  rates: {},
  lastUpdated: null,
  baseCurrency: 'USD'
};

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// @route   GET /api/currency/rates
// @desc    Get current exchange rates
// @access  Private
router.get('/rates', auth, async (req, res) => {
  try {
    const { base = 'USD' } = req.query;

    // Check cache
    const now = new Date();
    if (
      exchangeRateCache.lastUpdated &&
      exchangeRateCache.baseCurrency === base &&
      (now - exchangeRateCache.lastUpdated) < CACHE_DURATION
    ) {
      return res.json({
        base,
        rates: exchangeRateCache.rates,
        lastUpdated: exchangeRateCache.lastUpdated
      });
    }

    // Fetch fresh rates
    let rates = {};
    
    try {
      // Try primary API (exchangerate-api.com)
      const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${base}`, {
        timeout: 5000
      });
      rates = response.data.rates;
    } catch (primaryError) {
      console.warn('Primary currency API failed, trying fallback...');
      
      try {
        // Fallback to fixer.io (requires API key)
        if (process.env.FIXER_API_KEY) {
          const response = await axios.get(`http://data.fixer.io/api/latest`, {
            params: {
              access_key: process.env.FIXER_API_KEY,
              base: base
            },
            timeout: 5000
          });
          rates = response.data.rates;
        } else {
          throw new Error('No fallback API key configured');
        }
      } catch (fallbackError) {
        console.warn('Fallback currency API failed, using default rates...');
        
        // Use default rates as last resort
        rates = getDefaultRates(base);
      }
    }

    // Update cache
    exchangeRateCache = {
      rates,
      lastUpdated: now,
      baseCurrency: base
    };

    res.json({
      base,
      rates,
      lastUpdated: now
    });
  } catch (error) {
    console.error('Get exchange rates error:', error);
    res.status(500).json({ message: 'Server error while fetching exchange rates' });
  }
});

// @route   POST /api/currency/convert
// @desc    Convert amount between currencies
// @access  Private
router.post('/convert', auth, async (req, res) => {
  try {
    const { amount, from, to } = req.body;

    if (!amount || !from || !to) {
      return res.status(400).json({ message: 'Amount, from, and to currencies are required' });
    }

    if (from === to) {
      return res.json({
        originalAmount: amount,
        convertedAmount: amount,
        fromCurrency: from,
        toCurrency: to,
        exchangeRate: 1,
        convertedAt: new Date()
      });
    }

    // Get exchange rates with 'from' currency as base
    let rates = {};
    
    try {
      const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`, {
        timeout: 5000
      });
      rates = response.data.rates;
    } catch (error) {
      console.warn('Currency API failed, using cached/default rates...');
      
      // Try to use cached rates or defaults
      if (exchangeRateCache.baseCurrency === from && exchangeRateCache.rates) {
        rates = exchangeRateCache.rates;
      } else {
        rates = getDefaultRates(from);
      }
    }

    const exchangeRate = rates[to];
    if (!exchangeRate) {
      return res.status(400).json({ message: `Exchange rate not available for ${from} to ${to}` });
    }

    const convertedAmount = Math.round(amount * exchangeRate * 100) / 100;

    res.json({
      originalAmount: amount,
      convertedAmount,
      fromCurrency: from,
      toCurrency: to,
      exchangeRate,
      convertedAt: new Date()
    });
  } catch (error) {
    console.error('Currency conversion error:', error);
    res.status(500).json({ message: 'Server error while converting currency' });
  }
});

// @route   GET /api/currency/supported
// @desc    Get list of supported currencies
// @access  Private
router.get('/supported', auth, async (req, res) => {
  try {
    const supportedCurrencies = {
      'USD': { name: 'US Dollar', symbol: '$' },
      'EUR': { name: 'Euro', symbol: '€' },
      'GBP': { name: 'British Pound', symbol: '£' },
      'JPY': { name: 'Japanese Yen', symbol: '¥' },
      'AUD': { name: 'Australian Dollar', symbol: 'A$' },
      'CAD': { name: 'Canadian Dollar', symbol: 'C$' },
      'CHF': { name: 'Swiss Franc', symbol: 'CHF' },
      'CNY': { name: 'Chinese Yuan', symbol: '¥' },
      'INR': { name: 'Indian Rupee', symbol: '₹' },
      'KRW': { name: 'South Korean Won', symbol: '₩' },
      'SGD': { name: 'Singapore Dollar', symbol: 'S$' },
      'HKD': { name: 'Hong Kong Dollar', symbol: 'HK$' },
      'NOK': { name: 'Norwegian Krone', symbol: 'kr' },
      'SEK': { name: 'Swedish Krona', symbol: 'kr' },
      'DKK': { name: 'Danish Krone', symbol: 'kr' },
      'PLN': { name: 'Polish Zloty', symbol: 'zł' },
      'CZK': { name: 'Czech Koruna', symbol: 'Kč' },
      'HUF': { name: 'Hungarian Forint', symbol: 'Ft' },
      'RUB': { name: 'Russian Ruble', symbol: '₽' },
      'BRL': { name: 'Brazilian Real', symbol: 'R$' },
      'MXN': { name: 'Mexican Peso', symbol: '$' },
      'ZAR': { name: 'South African Rand', symbol: 'R' },
      'TRY': { name: 'Turkish Lira', symbol: '₺' },
      'NZD': { name: 'New Zealand Dollar', symbol: 'NZ$' },
      'THB': { name: 'Thai Baht', symbol: '฿' },
      'MYR': { name: 'Malaysian Ringgit', symbol: 'RM' },
      'IDR': { name: 'Indonesian Rupiah', symbol: 'Rp' },
      'PHP': { name: 'Philippine Peso', symbol: '₱' },
      'VND': { name: 'Vietnamese Dong', symbol: '₫' }
    };

    res.json({ currencies: supportedCurrencies });
  } catch (error) {
    console.error('Get supported currencies error:', error);
    res.status(500).json({ message: 'Server error while fetching supported currencies' });
  }
});

// Helper function to get default exchange rates (fallback)
function getDefaultRates(baseCurrency) {
  const defaultUSDRates = {
    'EUR': 0.85,
    'GBP': 0.73,
    'JPY': 110.0,
    'AUD': 1.35,
    'CAD': 1.25,
    'CHF': 0.92,
    'CNY': 6.45,
    'INR': 74.0,
    'KRW': 1180.0,
    'SGD': 1.35,
    'HKD': 7.8,
    'NOK': 8.5,
    'SEK': 8.6,
    'DKK': 6.3,
    'PLN': 3.8,
    'CZK': 21.5,
    'HUF': 295.0,
    'RUB': 73.0,
    'BRL': 5.2,
    'MXN': 20.0,
    'ZAR': 14.5,
    'TRY': 8.5,
    'NZD': 1.4,
    'THB': 31.0,
    'MYR': 4.1,
    'IDR': 14300.0,
    'PHP': 49.0,
    'VND': 23000.0
  };

  if (baseCurrency === 'USD') {
    return { 'USD': 1, ...defaultUSDRates };
  }

  // Convert rates to use different base currency
  const usdToBaseRate = defaultUSDRates[baseCurrency];
  if (!usdToBaseRate) {
    return { [baseCurrency]: 1 }; // Return minimal rates if base currency not supported
  }

  const convertedRates = { [baseCurrency]: 1 };
  convertedRates['USD'] = 1 / usdToBaseRate;

  Object.entries(defaultUSDRates).forEach(([currency, rate]) => {
    if (currency !== baseCurrency) {
      convertedRates[currency] = rate / usdToBaseRate;
    }
  });

  return convertedRates;
}

module.exports = router;