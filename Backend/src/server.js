import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'BudPay - The Fair Pay Helper (Backend API)',
    environment: 'sandbox',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`BudPay backend kitchen running on http://localhost:${PORT}`);
  console.log(`Safety mode active: Targeting PayPal Sandbox (${PAYPAL_API_BASE})`);
});

