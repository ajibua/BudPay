import './env-bootstrap.js';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import {
  getPayPalAccessToken, createBatchPayout, getPayoutStatus,
  createOrder, captureOrder, getOrderDetails
} from './services/paypal.js';
import { parseCrewStory } from './services/gemini.js';
import { calculateFairPay, validatePaymentGuardrails } from './services/mathEngine.js';
import {
  createJob, updateJobStatus, updateJobPayment, updateJobFinancials, updateJobStory, claimJobForPayout,
  recordPayout, updatePayoutStatuses, getSavedPeople, findPeopleByIds, getJob,
  addSavedPerson, getAllJobs, isPersistentStoreConfigured
} from './services/db.js';

const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const paypalSandboxIsValid = (() => {
  try {
    const endpoint = new URL(PAYPAL_API_BASE);
    return endpoint.protocol === 'https:' && endpoint.hostname === 'api-m.sandbox.paypal.com';
  } catch {
    return false;
  }
})();
if (!paypalSandboxIsValid) {
  console.error('FATAL SAFETY GUARD: BudPay must only connect to https://api-m.sandbox.paypal.com');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json({ limit: '64kb' }));

function moneyToCents(value, label) {
  const amount = Number(value);
  const scaled = amount * 100;
  const cents = Math.round(scaled);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents) || cents > 2147483647 || Math.abs(scaled - cents) > 1e-7) {
    throw new Error(`${label} must be a non-negative amount with at most two decimal places and within the supported storage range.`);
  }
  return cents;
}

function requireStorage(res) {
  if (isPersistentStoreConfigured) return true;
  res.status(503).json({
    success: false,
    error: 'Persistent Supabase storage must be configured before checkout or payouts are enabled.'
  });
  return false;
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'BudPay - The Fair Pay Helper (Backend API)',
    environment: 'sandbox',
    persistentStorage: isPersistentStoreConfigured,
    storageMode: isPersistentStoreConfigured ? 'supabase' : 'in-memory',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/people', async (req, res) => {
  try {
    res.json({ success: true, data: await getSavedPeople() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/people', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    const { name, role, email, defaultWeight = 1.0 } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Crew member name is required.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'A valid PayPal email is required.' });
    }
    const weight = Number(defaultWeight) || 1.0;
    if (weight < 1.0 || weight > 2.5) {
      return res.status(400).json({ success: false, error: 'Default skill weight must be between 1.0 and 2.5.' });
    }
    const person = await addSavedPerson({
      name: name.trim(),
      role: (role || 'Crew Member').trim(),
      email: email.trim(),
      defaultWeight: weight
    });
    res.json({ success: true, person });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const DYNAMIC_PRESETS = [
  {
    id: 'tailoring',
    title: "Tunde's Wedding Outfits (Tailoring)",
    domain: "Fashion & Tailoring",
    story: "Tola sewed for 8 hours. Bisi did the finishing for 5 hours. Kunle did the delivery, about 2 hours.",
    payment: 200,
    costs: 40,
    bossShare: 90
  },
  {
    id: 'catering',
    title: "Weekend Barbecue Catering",
    domain: "Event Catering",
    story: "Chef Ayo prepped the grill for 6 hours. Bola served drinks for 4 hours. Segun washed dishes for 3 hours.",
    payment: 250,
    costs: 50,
    bossShare: 110
  },
  {
    id: 'production',
    title: "Commercial Video Shoot",
    domain: "Creative Media",
    story: "David filmed the keynote for 5 hours. Sarah handled sound engineering for 4 hours. Femi edited the footage for 3 hours.",
    payment: 450,
    costs: 75,
    bossShare: 200
  },
  {
    id: 'cleaning',
    title: "Commercial Office Sanitization",
    domain: "Facilities Cleaning",
    story: "Grace sanitized the restrooms and kitchen for 5 hours. Michael steam cleaned the carpets for 4 hours. Samuel disposed of recyclables for 2 hours.",
    payment: 320,
    costs: 50,
    bossShare: 140
  }
];

app.get('/api/presets', (req, res) => {
  res.json({ success: true, data: DYNAMIC_PRESETS });
});

app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await getAllJobs();
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/ai/parse-story', async (req, res) => {
  try {
    const { story } = req.body;
    if (typeof story !== 'string' || !story.trim() || story.length > 5000) {
      return res.status(400).json({ success: false, error: 'Story must contain between 1 and 5000 characters.' });
    }
    const parsedResult = await parseCrewStory(story);
    res.json({ success: true, data: parsedResult });
  } catch (err) {
    console.error('AI Parse Story Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/jobs/:jobId/story', async (req, res) => {
  try {
    const story = req.body?.story;
    if (typeof story !== 'string' || !story.trim() || story.length > 5000) {
      return res.status(400).json({ success: false, error: 'Story must contain between 1 and 5000 characters.' });
    }
    const job = await updateJobStory(req.params.jobId, story.trim());
    res.json({ success: true, jobId: job.id });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/pay/calculate', (req, res) => {
  try {
    const { totalCustomerPaymentCents, materialCostsCents = 0, bossShareCents = 0, crewMembers = [] } = req.body;
    if (![totalCustomerPaymentCents, materialCostsCents, bossShareCents].every(value => Number.isSafeInteger(value) && value >= 0) || !Array.isArray(crewMembers)) {
      return res.status(400).json({ success: false, error: 'Non-negative whole-cent amounts and a crewMembers array are required.' });
    }
    const calculation = calculateFairPay({ totalCustomerPaymentCents, materialCostsCents, bossShareCents, crewMembers });
    const guardrails = validatePaymentGuardrails({ totalCustomerPaymentCents, materialCostsCents, bossShareCents, allocations: calculation.allocations });
    res.json({ success: true, data: { ...calculation, guardrails } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/paypal/create-order', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    const { amount, currency = 'USD', description = 'BudPay Job Payment', materialCosts = 0, bossShare = 0, title = 'BudPay Job' } = req.body;
    const totalCents = moneyToCents(amount, 'Customer payment');
    const costsCents = moneyToCents(materialCosts, 'Material costs');
    const bossCents = moneyToCents(bossShare, "Boss's share");
    if (totalCents < 1) throw new Error('Customer payment must be at least one cent.');
    if (costsCents + bossCents > totalCents) throw new Error('Costs and boss share cannot exceed customer payment.');
    if (currency !== 'USD') throw new Error('BudPay currently supports USD sandbox orders only.');

    const order = await createOrder({ amount: totalCents / 100, currency, description });
    const job = await createJob({
      title: String(title).slice(0, 255), totalCustomerPaymentCents: totalCents,
      materialCostsCents: costsCents, bossShareCents: bossCents,
      crewPileCents: totalCents - costsCents - bossCents, paypalOrderId: order.id
    });
    const approvalUrl = order.links?.find(link => link.rel === 'approve')?.href;
    res.json({ success: true, jobId: job.id, orderId: order.id, status: order.status, approvalUrl });
  } catch (err) {
    console.error('Create Order Error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/paypal/capture-order/:orderId', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    const { orderId } = req.params;
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ success: false, error: 'jobId is required.' });
    let job = await getJob(jobId);
    if (!job || job.paypalOrderId !== orderId) return res.status(404).json({ success: false, error: 'This PayPal order is not linked to the requested job.' });
    if (job.paymentCaptured) return res.json({ success: true, status: 'COMPLETED', jobId: job.id, alreadyCaptured: true });

    const details = await getOrderDetails(orderId);
    if (!['APPROVED', 'COMPLETED'].includes(details.status)) {
      return res.status(409).json({ success: false, error: 'The customer must approve the PayPal order before capture.', status: details.status });
    }
    const orderAmount = details.purchase_units?.[0]?.amount;
    if (orderAmount?.currency_code !== 'USD' || moneyToCents(orderAmount.value, 'PayPal order amount') !== job.totalCustomerPaymentCents) {
      return res.status(409).json({ success: false, error: 'PayPal order amount does not match this job.' });
    }
    const capture = details.status === 'COMPLETED' ? details : await captureOrder(orderId);
    if (capture.status !== 'COMPLETED') {
      return res.status(409).json({ success: false, error: `PayPal capture is ${capture.status || 'not completed'}.`, status: capture.status });
    }
    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    if (!captureId) throw new Error('PayPal completed the order without returning a capture ID.');
    await updateJobPayment(job.id, { paypalOrderId: orderId, paypalCaptureId: captureId });
    res.json({ success: true, status: capture.status, captureId, jobId: job.id });
  } catch (err) {
    console.error('Capture Order Error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/paypal/order/:orderId', async (req, res) => {
  try {
    const details = await getOrderDetails(req.params.orderId);
    res.json({ success: true, order: details });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/pay/approve-and-send', async (req, res) => {
  let retrySenderBatchId = null;
  try {
    if (!requireStorage(res)) return;
    let {
      jobId,
      allocations = [],
      bossShareCents,
      story,
      emailSubject,
      emailMessage
    } = req.body;

    if (typeof jobId !== 'string' || !jobId) {
      return res.status(400).json({ success: false, error: 'A valid captured jobId is required.' });
    }
    let job = await getJob(jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found.' });

    if (job.status === 'sent' && job.paypalPayoutBatchId) {
      retrySenderBatchId = job.paypalSenderBatchId;
      const batch = await getPayoutStatus(job.paypalPayoutBatchId);
      res.json({
        success: true, alreadySent: true, jobId: job.id,
        batchId: job.paypalPayoutBatchId,
        batchStatus: batch.batch_header?.batch_status || 'PENDING',
        senderBatchId: job.paypalSenderBatchId,
        allocations: job.payoutRequest?.allocations || []
      });
      return;
    }

    if (job.status === 'approved' && job.paypalSenderBatchId && job.paypalClaimedAt) {
      const claimAgeMs = Date.now() - new Date(job.paypalClaimedAt).getTime();
      if (!Number.isFinite(claimAgeMs) || claimAgeMs >= 30 * 24 * 60 * 60 * 1000) {
        return res.status(409).json({
          success: false,
          error: 'This payout claim is outside PayPal’s 30-day idempotency window. Reconcile the batch manually before retrying.'
        });
      }
    }

    if (!job.paymentCaptured || !job.paypalCaptureId) {
      return res.status(409).json({ success: false, error: 'Customer payment must be captured before crew payouts.' });
    }
    if (!Number.isSafeInteger(bossShareCents) || bossShareCents < 0 || bossShareCents > 2147483647) {
      return res.status(400).json({ success: false, error: "Boss's share must be submitted as whole cents." });
    }
    if (!(job.status === 'approved' && job.paypalSenderBatchId && job.payoutRequest)) {
      if (!['draft', 'reviewed'].includes(job.status)) {
        if (job.status !== 'approved') {
          return res.status(409).json({ success: false, error: `Job cannot be approved from status ${job.status}.` });
        }
      }
      if (job.status === 'draft') {
        if (typeof story !== 'string' || !story.trim() || story.length > 5000) {
          return res.status(400).json({ success: false, error: 'The reviewed work story is required.' });
        }
        await updateJobStory(job.id, story.trim());
        await updateJobFinancials(job.id, bossShareCents);
        job = await getJob(job.id);
      }
    }

    let payoutRequest;
    let senderBatchId;

    if (job.status === 'approved' && job.paypalSenderBatchId && job.payoutRequest) {
      senderBatchId = job.paypalSenderBatchId;
      retrySenderBatchId = senderBatchId;
      payoutRequest = job.payoutRequest;
    } else {
      if (!Array.isArray(allocations) || allocations.length === 0 || allocations.length > 50) {
        return res.status(400).json({ success: false, error: 'Between 1 and 50 crew allocations are required.' });
      }

      const requestedIds = allocations.map(item => String(item.personId || item.id || ''));
      if (requestedIds.some(id => !id) || new Set(requestedIds).size !== requestedIds.length) {
        return res.status(400).json({ success: false, error: 'Each crew allocation must identify a different saved roster member.' });
      }
      const savedPeople = await findPeopleByIds(requestedIds);
      if (savedPeople.length !== requestedIds.length) {
        return res.status(400).json({ success: false, error: 'Every payout recipient must be an active saved crew member.' });
      }
      const personById = new Map(savedPeople.map(person => [person.id, person]));

      const validAllocations = allocations.map((item, idx) => {
        const personId = requestedIds[idx];
        const person = personById.get(personId);
        if (!person) throw new Error(`Crew member #${idx + 1} is not on the active roster.`);
        const hours = Number(item.hours);
        const jobWeight = Number(item.jobWeight);
        if (!Number.isFinite(hours) || hours <= 0 || hours > 1000 || !Number.isFinite(jobWeight) || jobWeight < 1 || jobWeight > 2.5) {
          throw new Error(`Invalid hours or skill weight for ${person.name}.`);
        }
        return {
          id: person.id,
          personId: person.id,
          name: person.name,
          job: String(item.job || item.role || person.role || 'Crew Member').slice(0, 100),
          email: person.email,
          hours,
          jobWeight,
          thankYouNoteDraft: String(item.thankYouNoteDraft || item.thankYouNote || `Thank you ${person.name} for your great work!`).trim().slice(0, 500)
        };
      });

      // Calculate fair pay deterministically
      const calculation = calculateFairPay({
        totalCustomerPaymentCents: job.totalCustomerPaymentCents,
        materialCostsCents: job.materialCostsCents,
        bossShareCents: job.bossShareCents,
        crewMembers: validAllocations
      });

      const guardrailCheck = validatePaymentGuardrails({
        totalCustomerPaymentCents: job.totalCustomerPaymentCents,
        materialCostsCents: job.materialCostsCents,
        bossShareCents: job.bossShareCents,
        allocations: calculation.allocations
      });

      if (!guardrailCheck.isValid) {
        return res.status(400).json({ success: false, error: guardrailCheck.errors.join(' | ') });
      }

      if (job.status === 'draft') {
        await updateJobStatus(job.id, 'reviewed', { allocations: calculation.allocations });
        job = await updateJobStatus(job.id, 'approved', { allocations: calculation.allocations });
      } else if (job.status === 'reviewed') {
        job = await updateJobStatus(job.id, 'approved', { allocations: calculation.allocations });
      }

      senderBatchId = `budpay_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      retrySenderBatchId = senderBatchId;
      const payoutItems = calculation.allocations.map((item, i) => ({
        recipientEmail: item.email,
        amount: item.amountCents / 100,
        note: item.thankYouNote || `Thank you ${item.name} for your work!`,
        itemId: `item_${job.id}_${i}`.slice(0, 30)
      }));
      payoutRequest = {
        allocations: calculation.allocations,
        payoutItems,
        emailSubject: String(emailSubject || "You've received your fair pay from BudPay!").slice(0, 255),
        emailMessage: String(emailMessage || 'Thank you for your hard work and great contribution!').slice(0, 1000)
      };
      await claimJobForPayout(job.id, senderBatchId, payoutRequest);
    }

    const paypalResult = await createBatchPayout({
      payoutItems: payoutRequest.payoutItems,
      emailSubject: payoutRequest.emailSubject,
      emailMessage: payoutRequest.emailMessage,
      customBatchId: senderBatchId
    });

    await recordPayout({ jobId: job.id, batchId: paypalResult.batchId, allocations: payoutRequest.allocations });
    await updateJobStatus(job.id, 'sent', {
      paypalPayoutBatchId: paypalResult.batchId,
      paypalSenderBatchId: senderBatchId
    });

    res.json({
      success: true,
      message: 'PayPal accepted the payout batch; each item is being confirmed.',
      jobId: job.id,
      batchId: paypalResult.batchId,
      batchStatus: paypalResult.batchStatus,
      senderBatchId: paypalResult.senderBatchId,
      allocations: payoutRequest.allocations
    });
  } catch (err) {
    console.error('Approve and Send Error:', err.message);
    res.status(retrySenderBatchId ? 502 : 400).json({
      success: false,
      error: err.message,
      ...(retrySenderBatchId ? { senderBatchId: retrySenderBatchId, safeToRetry: true } : {})
    });
  }
});

app.get('/api/paypal/test-auth', async (req, res) => {
  try {
    const tokenInfo = await getPayPalAccessToken();
    res.json({ success: true, message: 'Successfully authenticated with PayPal Sandbox!', tokenType: tokenInfo.tokenType, expiresIn: tokenInfo.expiresIn, appId: tokenInfo.appId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/paypal/payout/:batchId', async (req, res) => {
  try {
    const status = await getPayoutStatus(req.params.batchId);
    if (Array.isArray(status.items)) {
      try { await updatePayoutStatuses(req.params.batchId, status.items); }
      catch (dbError) { console.error('Could not save payout statuses:', dbError.message); }
    }
    res.json({ success: true, batch: status });
  } catch (err) {
    console.error('Fetch Payout Status Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`BudPay backend kitchen running on http://localhost:${PORT}`);
  console.log(`Safety mode active: Targeting PayPal Sandbox (${PAYPAL_API_BASE})`);
  console.log(`Storage engine: ${isPersistentStoreConfigured ? 'Supabase Cloud (PostgreSQL)' : 'In-memory preview only (checkout and payouts disabled)'}`);
});
