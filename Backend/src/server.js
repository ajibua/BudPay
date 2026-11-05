import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPayPalAccessToken, createSinglePayout, getPayoutStatus } from './services/paypal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from Backend folder
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Safety Guardrail: Prevent running with live/production PayPal endpoints in hackathon playground
const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
if (!PAYPAL_API_BASE.includes('sandbox')) {
  console.error('FATAL SAFETY GUARD: BudPay must only connect to PayPal Sandbox environments!');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'BudPay - The Fair Pay Helper (Backend API)',
    environment: 'sandbox',
    timestamp: new Date().toISOString()
  });
});

// Day 2: Test PayPal OAuth2 Access Token
app.get('/api/paypal/test-auth', async (req, res) => {
  try {
    const tokenInfo = await getPayPalAccessToken();
    res.json({
      success: true,
      message: 'Successfully authenticated with PayPal Sandbox!',
      tokenType: tokenInfo.tokenType,
      expiresIn: tokenInfo.expiresIn,
      appId: tokenInfo.appId,
    });
  } catch (err) {
    console.error('Test Auth Error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Day 2: Send a single test payout to a crew member sandbox email
app.post('/api/paypal/test-payout', async (req, res) => {
  try {
    const { recipientEmail, amount = 5.00, note = 'BudPay Day 2 test payout' } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        error: 'recipientEmail is required (use one of your Sandbox Personal crew emails)',
      });
    }

    const result = await createSinglePayout({ recipientEmail, amount, note });
    res.json({
      success: true,
      message: `Payout batch submitted successfully to ${recipientEmail}!`,
      batchId: result.batchId,
      batchStatus: result.batchStatus,
      senderBatchId: result.senderBatchId,
    });
  } catch (err) {
    console.error('Test Payout Error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Day 2: Query payout batch status
app.get('/api/paypal/payout/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const status = await getPayoutStatus(batchId);
    res.json({
      success: true,
      batch: status,
    });
  } catch (err) {
    console.error('Fetch Payout Status Error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`BudPay backend kitchen running on http://localhost:${PORT}`);
  console.log(`Safety mode active: Targeting PayPal Sandbox (${PAYPAL_API_BASE})`);
});
