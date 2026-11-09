import '../env-bootstrap.js';
// PayPal API service for BudPay
const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

// Ensure safety check: never connect to live PayPal
const isAllowedPayPalSandbox = (() => {
  try {
    const endpoint = new URL(PAYPAL_API_BASE);
    return endpoint.protocol === 'https:' && endpoint.hostname === 'api-m.sandbox.paypal.com';
  } catch {
    return false;
  }
})();
if (!isAllowedPayPalSandbox) {
  throw new Error('FATAL SAFETY GUARD: PAYPAL_API_BASE must be https://api-m.sandbox.paypal.com');
}

function formatPayPalError(data, response, fallback) {
  const diagnostics = Array.isArray(data.details)
    ? data.details.map(detail => [detail.issue, detail.field, detail.description].filter(Boolean).join(': ')).join('; ')
    : '';
  const debugId = data.debug_id ? `PayPal reference: ${data.debug_id}` : '';
  const error = new Error([data.message || fallback, diagnostics, debugId].filter(Boolean).join(' — '));
  error.status = response.status;
  error.code = data.name || 'PAYPAL_API_ERROR';
  return error;
}

// Fetch OAuth2 Access Token from PayPal Sandbox using Client ID & Secret
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


// Customer Checkout: Create a PayPal Order (e.g., $200 for wedding outfits)
export async function createOrder({ amount, currency = 'USD', description = 'BudPay Job Payment', returnUrl, cancelUrl }) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Valid order amount is required');
  }

  const { accessToken } = await getPayPalAccessToken();

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        description,
        amount: {
          currency_code: currency,
          value: numericAmount.toFixed(2),
        },
      },
    ],
    application_context: {
      user_action: 'PAY_NOW',
      return_url: returnUrl || process.env.PAYPAL_RETURN_URL || 'http://localhost:3000',
      cancel_url: cancelUrl || process.env.PAYPAL_RETURN_URL || 'http://localhost:3000',
    },
  };

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('PayPal Order Creation Error:', data);
    throw formatPayPalError(data, response, 'PayPal could not create the order.');
  }

  return data;
}

// Customer Checkout: Capture PayPal Order once approved by customer
export async function captureOrder(orderId) {
  if (!orderId) {
    throw new Error('orderId is required');
  }

  const { accessToken } = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('PayPal Order Capture Error:', data);
    throw formatPayPalError(data, response, 'PayPal could not capture the order.');
  }

  return data;
}

// Customer Checkout: Get details of an order
export async function getOrderDetails(orderId) {
  const { accessToken } = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('PayPal Order Details Error:', data);
    throw formatPayPalError(data, response, 'Could not check PayPal order status.');
  }

  return data;
}

// Send a test or single payout to a crew member in the Sandbox
export async function createSinglePayout({ recipientEmail, amount, note, currency = 'USD' }) {
  return createBatchPayout({
    payoutItems: [
      {
        recipientEmail,
        amount,
        note: note || 'Fair pay from BudPay',
      },
    ],
    emailSubject: 'You received a payment from BudPay!',
    emailMessage: note || 'Thank you for your hard work on the project!',
    currency,
  });
}

// Send a batch payout to multiple crew members at once (Milestone 5 & Day 6 requirement)
function findPayoutResourceLink(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPayoutResourceLink(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  if (typeof value.href === 'string' && /\/v1\/payments\/payouts\//.test(value.href)) return value.href;
  for (const child of Object.values(value)) {
    const found = findPayoutResourceLink(child);
    if (found) return found;
  }
  return null;
}
export async function createBatchPayout({ payoutItems, emailSubject, emailMessage, currency = 'USD', customBatchId }) {
  if (!payoutItems || !payoutItems.length) {
    throw new Error('At least one payout item is required');
  }

  const { accessToken } = await getPayPalAccessToken();

  const senderBatchId = customBatchId || `budpay_batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const senderItemIds = new Set();
  const items = payoutItems.map((item, index) => {
    const recipientEmail = String(item.recipientEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      throw new Error(`A valid saved PayPal email is required for payout item #${index + 1}.`);
    }
    const numericAmount = Number(item.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || Math.abs(numericAmount * 100 - Math.round(numericAmount * 100)) > 1e-7) {
      throw new Error(`Invalid payout amount for recipient: ${item.recipientEmail}`);
    }
    const senderItemId = String(item.itemId || `item_${index}`).slice(0, 30);
    if (senderItemIds.has(senderItemId)) {
      throw new Error('Payout item IDs must be unique within a PayPal batch.');
    }
    senderItemIds.add(senderItemId);
    return {
      recipient_type: 'EMAIL',
      amount: {
        value: numericAmount.toFixed(2),
        currency: item.currency || currency,
      },
      note: item.note || 'Fair pay from BudPay',
      receiver: recipientEmail,
      sender_item_id: senderItemId,
    };
  });

  const payload = {
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      email_subject: emailSubject || 'You received a payment from BudPay!',
      email_message: emailMessage || 'Fair pay for your contributions!',
    },
    items,
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
    console.error('PayPal Batch Payout Creation Error:', data);
    const duplicate = /duplicate|already used|already exists/i.test(JSON.stringify(data));
    const payoutLink = findPayoutResourceLink(data);
    const originalBatchId = payoutLink?.match(/\/v1\/payments\/payouts\/([^/?]+)/)?.[1];
    if (duplicate && originalBatchId) {
      const original = await getPayoutStatus(originalBatchId);
      return {
        batchId: original.batch_header.payout_batch_id,
        batchStatus: original.batch_header.batch_status,
        senderBatchId: original.batch_header.sender_batch_header?.sender_batch_id,
        raw: original,
        recoveredDuplicate: true
      };
    }
    const error = new Error(data.message || JSON.stringify(data));
    error.status = response.status;
    error.paypalData = data;
    throw error;
  }

  return {
    batchId: data.batch_header.payout_batch_id,
    batchStatus: data.batch_header.batch_status,
    senderBatchId: data.batch_header.sender_batch_header.sender_batch_id,
    raw: data,
  };
}

// Check the status of a payout batch in PayPal Sandbox
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
