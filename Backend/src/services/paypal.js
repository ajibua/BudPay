const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

// Ensure safety check: never connect to live PayPal
if (!PAYPAL_API_BASE.includes('sandbox')) {
  throw new Error('FATAL SAFETY GUARD: PAYPAL_API_BASE must point to sandbox.paypal.com');
}

//Fetch OAuth2 Access Token from PayPal Sandbox using Client ID & Secret
export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in environment.');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('PayPal OAuth2 Error:', data);
    throw new Error(data.error_description || data.error || 'Failed to authenticate with PayPal');
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    appId: data.app_id,
    expiresIn: data.expires_in,
  };
}

//Send a test or single payout to a crew member in the Sandbox
export async function createSinglePayout({ recipientEmail, amount, note, currency = 'USD' }) {
  if (!recipientEmail) {
    throw new Error('Recipient email is required');
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Valid positive amount required');
  }

  const { accessToken } = await getPayPalAccessToken();

  const senderBatchId = `budpay_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const payload = {
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      email_subject: 'You received a payment from BudPay!',
      email_message: note || 'Thank you for your hard work on the project!',
    },
    items: [
      {
        recipient_type: 'EMAIL',
        amount: {
          value: numericAmount.toFixed(2),
          currency,
        },
        note: note || 'Fair pay from BudPay',
        receiver: recipientEmail,
        sender_item_id: `item_${Date.now()}`,
      },
    ],
  };

  const response = await fetch(`${PAYPAL_API_BASE}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('PayPal Payout Creation Error:', data);
    throw new Error(data.message || JSON.stringify(data));
  }

  return {
    batchId: data.batch_header.payout_batch_id,
    batchStatus: data.batch_header.batch_status,
    senderBatchId: data.batch_header.sender_batch_header.sender_batch_id,
    raw: data,
  };
}

//Check the status of a payout batch in PayPal Sandbox
export async function getPayoutStatus(batchId) {
  const { accessToken } = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v1/payments/payouts/${batchId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch payout status');
  }

  return data;
}
