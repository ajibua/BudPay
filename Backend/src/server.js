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
  createJob, updateJobStatus, updateJobPayment, updateJobFinancials, updateJobStory, claimJobForPayout, repairClaimedPayoutRequest,
  recordPayout, updatePayoutStatuses, getSavedPeople, findPeopleByIds, getJob,
  addSavedPerson, updateSavedPerson, deactivateSavedPerson, getAllJobs, getLearnedCrewHabits,
  getCrewPersonByEmail, getWorkLogs, createWorkLog, reviewWorkLog, isPersistentStoreConfigured
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

function payoutRequestHasRecipients(payoutRequest) {
  return Array.isArray(payoutRequest?.payoutItems) && payoutRequest.payoutItems.length > 0 &&
    payoutRequest.payoutItems.every(item => typeof item.recipientEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.recipientEmail));
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

// Supabase verifies the bearer token. The configured owner is the boss; an active
// roster email is a crew account with access only to its own time claims.
app.use('/api', async (req, res, next) => {
  const publicRoute = req.method === 'GET' && ['/health', '/presets'].includes(req.path);
  if (publicRoute) return next();

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const ownerEmail = process.env.BUDPAY_OWNER_EMAIL?.trim().toLowerCase();
  if (!supabaseUrl || !anonKey || !ownerEmail) {
    return res.status(503).json({
      success: false,
      error: 'Workspace authentication is not configured. Set SUPABASE_URL, a Supabase anon or publishable key, and BUDPAY_OWNER_EMAIL on the backend.'
    });
  }

  const authorization = req.get('authorization') || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ success: false, error: 'Sign in as the BudPay boss to continue.' });

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
    });
    if (!userResponse.ok) return res.status(401).json({ success: false, error: 'Your sign-in session is invalid or expired. Please sign in again.' });
    const user = await userResponse.json();
    if (!user.email_confirmed_at || typeof user.email !== 'string') {
      return res.status(403).json({ success: false, error: 'Use a confirmed email account to access BudPay.' });
    }
    const email = user.email.trim().toLowerCase();
    if (email === ownerEmail) {
      res.locals.budpayUser = { id: user.id, email: user.email, role: 'boss', person: null };
    } else {
      const person = await getCrewPersonByEmail(email);
      if (!person) {
        return res.status(403).json({ success: false, error: 'This account is not assigned to this BudPay workspace.' });
      }
      res.locals.budpayUser = {
        id: user.id,
        email: user.email,
        role: 'crew',
        person: { id: person.id, name: person.name, role: person.role }
      };
    }

    const userRole = res.locals.budpayUser.role;
    const isAuthMe = req.method === 'GET' && req.path === '/auth/me';
    const isCrewWorkLogRoute = req.path === '/crew/work-logs' && ['GET', 'POST'].includes(req.method);
    if (userRole === 'crew' && !isAuthMe && !isCrewWorkLogRoute) {
      return res.status(403).json({ success: false, error: 'Crew accounts can only submit and view their own work logs.' });
    }
    next();
  } catch (error) {
    console.error('Supabase auth verification failed:', error.message);
    res.status(503).json({ success: false, error: 'Could not verify your sign-in with Supabase. Please try again.' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const { role, person, ...user } = res.locals.budpayUser;
  res.json({ success: true, user, role, person });
});

function validateWorkLogInput({ workDate, task, hours, details = '' }) {
  const parsedDate = typeof workDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(workDate)
    ? new Date(`${workDate}T00:00:00.000Z`)
    : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== workDate) {
    return { error: 'Enter a valid work date.' };
  }
  if (workDate > new Date().toISOString().slice(0, 10)) return { error: 'Work date cannot be in the future.' };
  if (typeof task !== 'string' || !task.trim() || task.trim().length > 160) {
    return { error: 'Describe the task in 1 to 160 characters.' };
  }
  const numericHours = Number(hours);
  if (!Number.isFinite(numericHours) || numericHours <= 0 || numericHours > 24 ||
      Math.abs(numericHours * 100 - Math.round(numericHours * 100)) > 1e-7) {
    return { error: 'Hours must be greater than 0, no more than 24, and use at most two decimal places.' };
  }
  if (typeof details !== 'string' || details.trim().length > 1000) {
    return { error: 'Additional details must be 1000 characters or fewer.' };
  }
  return { value: { workDate, task: task.trim(), hours: numericHours, details: details.trim() } };
}

app.get('/api/crew/work-logs', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    const personId = res.locals.budpayUser.role === 'crew' ? res.locals.budpayUser.person.id : null;
    res.json({ success: true, data: await getWorkLogs({ personId }) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/crew/work-logs', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    if (res.locals.budpayUser.role !== 'crew') {
      return res.status(403).json({ success: false, error: 'Only a crew account can submit a work log.' });
    }
    const validation = validateWorkLogInput(req.body || {});
    if (validation.error) return res.status(400).json({ success: false, error: validation.error });
    const workLog = await createWorkLog({ personId: res.locals.budpayUser.person.id, ...validation.value });
    res.status(201).json({ success: true, workLog });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/work-logs', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    res.json({ success: true, data: await getWorkLogs() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/work-logs/:logId/review', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    const { status, reviewNote = '' } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Review status must be approved or rejected.' });
    }
    if (typeof reviewNote !== 'string' || reviewNote.trim().length > 1000) {
      return res.status(400).json({ success: false, error: 'Review note must be 1000 characters or fewer.' });
    }
    const workLog = await reviewWorkLog({
      logId: req.params.logId,
      status,
      reviewNote: reviewNote.trim(),
      reviewerId: res.locals.budpayUser.id
    });
    res.json({ success: true, workLog });
  } catch (err) {
    res.status(err.message.includes('not found or already reviewed') ? 404 : 500)
      .json({ success: false, error: err.message });
  }
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
    const { name, role, email, authEmail, defaultWeight = 1.0 } = req.body;
    const validation = validatePersonInput({ name, role, email, authEmail, defaultWeight });
    if (validation.error) return res.status(400).json({ success: false, error: validation.error });
    const person = await addSavedPerson({
      ...validation.value
    });
    res.json({ success: true, person });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/people/:personId', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    const validation = validatePersonInput(req.body);
    if (validation.error) return res.status(400).json({ success: false, error: validation.error });
    const person = await updateSavedPerson(req.params.personId, validation.value);
    res.json({ success: true, person });
  } catch (err) {
    const notFound = err.message.includes('not found or inactive');
    res.status(notFound ? 404 : 500).json({ success: false, error: err.message });
  }
});

app.delete('/api/people/:personId', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    await deactivateSavedPerson(req.params.personId);
    res.json({ success: true });
  } catch (err) {
    const notFound = err.message.includes('not found or already inactive');
    res.status(notFound ? 404 : 500).json({ success: false, error: err.message });
  }
});

function validatePersonInput({ name, role, email, authEmail, defaultWeight = 1.0 }) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
    return { error: 'Crew member name is required and must be 100 characters or fewer.' };
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 255) {
    return { error: 'A valid PayPal email of 255 characters or fewer is required.' };
  }
  const loginEmail = typeof authEmail === 'string' && authEmail.trim() ? authEmail.trim() : email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail) || loginEmail.length > 255) {
    return { error: 'A valid crew sign-in email of 255 characters or fewer is required.' };
  }
  if (loginEmail.toLowerCase() === process.env.BUDPAY_OWNER_EMAIL?.trim().toLowerCase()) {
    return { error: 'Crew sign-in email must be different from the boss account email.' };
  }
  if (role !== undefined && (typeof role !== 'string' || role.trim().length > 100)) {
    return { error: 'Role must be 100 characters or fewer.' };
  }
  const weight = Number(defaultWeight);
  if (!Number.isFinite(weight) || weight < 1.0 || weight > 2.5) {
    return { error: 'Default skill weight must be between 1.0 and 2.5.' };
  }
  return {
    value: {
      name: name.trim(),
      role: (role || 'Crew Member').trim(),
      email: email.trim(),
      authEmail: loginEmail.toLowerCase(),
      defaultWeight: weight
    }
  };
}

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

app.get('/api/learning/habits', async (req, res) => {
  try {
    res.json({ success: true, data: await getLearnedCrewHabits() });
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
    const hasClaimedRequest = job.status === 'approved' && Boolean(job.paypalSenderBatchId && job.payoutRequest);
    const repairClaimedRequest = hasClaimedRequest && !payoutRequestHasRecipients(job.payoutRequest);

    if (hasClaimedRequest && !repairClaimedRequest) {
      senderBatchId = job.paypalSenderBatchId;
      retrySenderBatchId = senderBatchId;
      payoutRequest = job.payoutRequest;
    } else {
      if (!Array.isArray(allocations) || allocations.length === 0 || allocations.length > 50) {
        return res.status(400).json({ success: false, error: 'Between 1 and 50 crew allocations are required.' });
      }

      const requestedIds = allocations.map(item => String(item.personId || '')).filter(Boolean);
      if (new Set(requestedIds).size !== requestedIds.length) {
        return res.status(400).json({ success: false, error: 'A saved crew member can appear only once in a payout.' });
      }
      const savedPeople = await findPeopleByIds(requestedIds);
      if (savedPeople.length !== requestedIds.length) {
        return res.status(400).json({ success: false, error: 'A selected saved crew member is no longer active.' });
      }
      const personById = new Map(savedPeople.map(person => [person.id, person]));
      const recipientEmails = new Set();

      const validAllocations = allocations.map((item, idx) => {
        const personId = String(item.personId || '');
        const person = personById.get(personId);
        if (personId && !person) throw new Error(`Crew member #${idx + 1} is not on the active roster.`);
        const email = String(person?.email || item.email || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error(`Enter a valid PayPal Sandbox email for ${person?.name || item.name || `crew member #${idx + 1}`}.`);
        }
        const normalizedEmail = email.toLowerCase();
        if (recipientEmails.has(normalizedEmail)) {
          throw new Error('Each PayPal recipient email can appear only once in a payout.');
        }
        recipientEmails.add(normalizedEmail);
        const hours = Number(item.hours);
        const jobWeight = Number(item.jobWeight);
        if (!Number.isFinite(hours) || hours <= 0 || hours > 1000 || !Number.isFinite(jobWeight) || jobWeight < 1 || jobWeight > 2.5) {
          throw new Error(`Invalid hours or skill weight for ${person?.name || item.name || `crew member #${idx + 1}`}.`);
        }
        return {
          id: person?.id || String(item.id || `crew_${idx}`),
          personId: person?.id || null,
          name: person?.name || String(item.name || `Crew ${idx + 1}`).trim().slice(0, 100),
          job: String(item.job || item.role || person?.role || 'Crew Member').slice(0, 100),
          email,
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

      senderBatchId = repairClaimedRequest
        ? job.paypalSenderBatchId
        : `budpay_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      retrySenderBatchId = senderBatchId;
      const payoutItems = calculation.allocations.map((item, i) => ({
        recipientEmail: item.email,
        amount: item.amountCents / 100,
        note: item.thankYouNote || `Thank you ${item.name} for your work!`,
        itemId: `item_${i}_${job.id.replace(/-/g, '').slice(-20)}`
      }));
      payoutRequest = {
        allocations: calculation.allocations,
        payoutItems,
        emailSubject: String(emailSubject || "You've received your fair pay from BudPay!").slice(0, 255),
        emailMessage: String(emailMessage || 'Thank you for your hard work and great contribution!').slice(0, 1000)
      };
      if (repairClaimedRequest) {
        await repairClaimedPayoutRequest(job.id, senderBatchId, payoutRequest);
      } else {
        await claimJobForPayout(job.id, senderBatchId, payoutRequest);
      }
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
