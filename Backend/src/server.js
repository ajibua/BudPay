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
  getCrewPersonByEmail, getWorkLogs, createWorkLog, reviewWorkLog, isPersistentStoreConfigured,
  getMarketplaceServices, getMarketplaceService, addMarketplaceService,
  getMarketplaceAgencyProfile, updateMarketplaceAgencyProfile, getMarketplacePortfolio,
  getAgencyById, getAgencyForUser, claimLegacyAgency, createAgencyForOwner, getMarketplaceAgencies,
  getAgencyJobByPaypalOrder, hasAgencyPayoutBatch,
  uploadMarketplacePortfolioImage, addMarketplacePortfolioItem, deleteMarketplacePortfolioItem, deleteMarketplacePortfolioImage,
  findMarketplaceBooking, updateMarketplaceCustomerStatus
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

// Each agency has its own boss and crew roster. Supabase verifies identity; the
// agency database mapping determines workspace access.
app.use('/api', async (req, res, next) => {
  const publicRoute = (req.method === 'GET' && ['/health', '/presets', '/marketplace/services', '/marketplace/agencies', '/marketplace/agency-profile'].includes(req.path)) ||
    (req.method === 'POST' && (req.path === '/marketplace/bookings' || req.path === '/marketplace/bookings/lookup' || /^\/marketplace\/bookings\/[0-9a-f-]+\/capture$/i.test(req.path)));
  if (publicRoute) return next();

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) {
    return res.status(503).json({
      success: false,
      error: 'Workspace authentication is not configured. Set SUPABASE_URL and a Supabase anon or publishable key on the backend.'
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
    let agency = await getAgencyForUser(user.id, email);
    if (!agency && email === process.env.BUDPAY_OWNER_EMAIL?.trim().toLowerCase()) {
      agency = await claimLegacyAgency(user.id, email);
    }
    if (agency?.id === 'tundestudio' && process.env.BUDPAY_AGENCY_NAME?.trim()) {
      agency = { ...agency, name: process.env.BUDPAY_AGENCY_NAME.trim() };
    }
    if (agency) {
      res.locals.budpayUser = {
        id: user.id,
        email: user.email,
        role: 'boss',
        agencyId: agency.id,
        agency,
        person: null
      };
    } else {
      const person = await getCrewPersonByEmail(email);
      if (person) {
        res.locals.budpayUser = {
          id: user.id,
          email: user.email,
          role: 'crew',
          agencyId: person.agencyId,
          agency: await getAgencyById(person.agencyId),
          person: { id: person.id, name: person.name, role: person.role, agencyId: person.agencyId }
        };
      } else {
        res.locals.budpayUser = { id: user.id, email: user.email, role: 'onboarding', agencyId: null, agency: null, person: null };
      }
    }

    const userRole = res.locals.budpayUser.role;
    const isAuthMe = req.method === 'GET' && req.path === '/auth/me';
    const isAgencySetup = req.method === 'POST' && req.path === '/agencies';
    const isCrewWorkLogRoute = req.path === '/crew/work-logs' && ['GET', 'POST'].includes(req.method);
    if (userRole === 'onboarding' && !isAuthMe && !isAgencySetup) {
      return res.status(403).json({ success: false, error: 'Create your agency workspace to continue.' });
    }
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
  res.json({ success: true, user, role, person, agency: res.locals.budpayUser.agency });
});

app.post('/api/agencies', async (req, res) => {
  try {
    if (res.locals.budpayUser?.role !== 'onboarding') {
      return res.status(409).json({ success: false, error: 'This account already belongs to an agency workspace.' });
    }
    const name = req.body?.name;
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 160) {
      return res.status(400).json({ success: false, error: 'Agency name must be 2 to 160 characters.' });
    }
    if (!requireStorage(res)) return;
    const id = crypto.randomUUID();
    const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'agency';
    const slug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
    const agency = await createAgencyForOwner({ id, name: name.trim(), slug, ownerUserId: res.locals.budpayUser.id, ownerEmail: res.locals.budpayUser.email });
    res.status(201).json({ success: true, agency });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
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
    res.json({ success: true, data: await getWorkLogs({ personId, agencyId: res.locals.budpayUser.agencyId }) });
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
    res.json({ success: true, data: await getWorkLogs({ agencyId: res.locals.budpayUser.agencyId }) });
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
      reviewerId: res.locals.budpayUser.id,
      agencyId: res.locals.budpayUser.agencyId
    });
    res.json({ success: true, workLog });
  } catch (err) {
    res.status(err.message.includes('not found or already reviewed') ? 404 : 500)
      .json({ success: false, error: err.message });
  }
});

app.get('/api/people', async (req, res) => {
  try {
    res.json({ success: true, data: await getSavedPeople(res.locals.budpayUser.agencyId) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/people', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    const { name, role, email, authEmail, defaultWeight = 1.0 } = req.body;
    const validation = validatePersonInput({ name, role, email, authEmail, defaultWeight, bossEmail: res.locals.budpayUser.email });
    if (validation.error) return res.status(400).json({ success: false, error: validation.error });
    const person = await addSavedPerson({
      ...validation.value,
      agencyId: res.locals.budpayUser.agencyId
    });
    res.json({ success: true, person });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/people/:personId', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    const validation = validatePersonInput({ ...req.body, bossEmail: res.locals.budpayUser.email });
    if (validation.error) return res.status(400).json({ success: false, error: validation.error });
    const person = await updateSavedPerson(req.params.personId, validation.value, res.locals.budpayUser.agencyId);
    res.json({ success: true, person });
  } catch (err) {
    const notFound = err.message.includes('not found or inactive');
    res.status(notFound ? 404 : 500).json({ success: false, error: err.message });
  }
});

app.delete('/api/people/:personId', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    await deactivateSavedPerson(req.params.personId, res.locals.budpayUser.agencyId);
    res.json({ success: true });
  } catch (err) {
    const notFound = err.message.includes('not found or already inactive');
    res.status(notFound ? 404 : 500).json({ success: false, error: err.message });
  }
});

function validatePersonInput({ name, role, email, authEmail, defaultWeight = 1.0, bossEmail }) {
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
  if (loginEmail.toLowerCase() === String(bossEmail || '').trim().toLowerCase()) {
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

// Public catalog. Each offer belongs to an agency workspace; prices are read here.
const MARKETPLACE_AGENCY_NAME = process.env.BUDPAY_AGENCY_NAME?.trim() || "Tunde's Tailoring Studio";
const MARKETPLACE_SERVICES = [
  {
    id: 'tailored-outfit',
    agencyId: 'tundestudio',
    agencyName: MARKETPLACE_AGENCY_NAME,
    category: 'Fashion & Tailoring',
    title: 'Custom occasion outfit',
    description: 'A made-to-measure outfit, finished and fitted by the studio team.',
    priceCents: 20000,
    turnaround: '5–7 days',
    initials: 'TS',
    color: 'from-amber-100 to-orange-200'
  },
  {
    id: 'garment-alterations',
    agencyId: 'tundestudio',
    agencyName: MARKETPLACE_AGENCY_NAME,
    category: 'Fashion & Tailoring',
    title: 'Garment alterations',
    description: 'A careful fit adjustment with professional finishing.',
    priceCents: 6500,
    turnaround: '2–3 days',
    initials: 'TS',
    color: 'from-rose-100 to-pink-200'
  }
];

app.get('/api/marketplace/services', async (req, res) => {
  try {
    const services = await getMarketplaceServices(MARKETPLACE_SERVICES);
    res.json({ success: true, data: services.map(service => service.agencyId === 'tundestudio' && process.env.BUDPAY_AGENCY_NAME?.trim()
      ? { ...service, agencyName: process.env.BUDPAY_AGENCY_NAME.trim() }
      : service) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/marketplace/agencies', async (req, res) => {
  try {
    const agencies = await getMarketplaceAgencies();
    res.json({ success: true, data: agencies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/marketplace/agency-profile', async (req, res) => {
  try {
    const agencyId = typeof req.query.agencyId === 'string' ? req.query.agencyId : 'tundestudio';
    const agencyRecord = await getAgencyById(agencyId);
    if (!agencyRecord) return res.status(404).json({ success: false, error: 'Agency not found.' });
    if (agencyId === 'tundestudio' && process.env.BUDPAY_AGENCY_NAME?.trim()) agencyRecord.name = process.env.BUDPAY_AGENCY_NAME.trim();
    const [profile, portfolio] = await Promise.all([
      getMarketplaceAgencyProfile(agencyId, agencyRecord.name),
      getMarketplacePortfolio(agencyId)
    ]);
    res.json({ success: true, data: { ...profile, portfolio } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/marketplace/agency-profile', async (req, res) => {
  try {
    if (res.locals.budpayUser?.role !== 'boss') return res.status(403).json({ success: false, error: 'Only the agency boss can edit this profile.' });
    const { tagline, story } = req.body || {};
    if (typeof tagline !== 'string' || tagline.trim().length < 8 || tagline.trim().length > 120) {
      return res.status(400).json({ success: false, error: 'The tagline must be 8 to 120 characters.' });
    }
    if (typeof story !== 'string' || story.trim().length < 40 || story.trim().length > 1800) {
      return res.status(400).json({ success: false, error: 'The story must be 40 to 1800 characters.' });
    }
    const profile = await updateMarketplaceAgencyProfile(res.locals.budpayUser.agencyId, { tagline: tagline.trim(), story: story.trim() }, res.locals.budpayUser.agency.name);
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

const PORTFOLIO_IMAGE_TYPES = {
  'image/jpeg': { extension: 'jpg', signature: bytes => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/png': { extension: 'png', signature: bytes => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/webp': { extension: 'webp', signature: bytes => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' }
};

app.post('/api/marketplace/portfolio', express.text({ type: 'text/plain', limit: '3mb' }), async (req, res) => {
  let imagePath;
  try {
    if (res.locals.budpayUser?.role !== 'boss') return res.status(403).json({ success: false, error: 'Only the agency boss can add portfolio work.' });
    if (!requireStorage(res)) return;
    let payload;
    try { payload = JSON.parse(req.body || ''); } catch { return res.status(400).json({ success: false, error: 'Portfolio details were not valid JSON.' }); }
    const { title, category, description, mimeType, imageData } = payload || {};
    if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 120) return res.status(400).json({ success: false, error: 'Project title must be 3 to 120 characters.' });
    if (typeof category !== 'string' || category.trim().length < 2 || category.trim().length > 100) return res.status(400).json({ success: false, error: 'Category must be 2 to 100 characters.' });
    if (typeof description !== 'string' || description.trim().length < 20 || description.trim().length > 500) return res.status(400).json({ success: false, error: 'Description must be 20 to 500 characters.' });
    const imageType = PORTFOLIO_IMAGE_TYPES[mimeType];
    if (!imageType || typeof imageData !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageData)) return res.status(400).json({ success: false, error: 'Choose a JPEG, PNG, or WebP image.' });
    const imageBuffer = Buffer.from(imageData, 'base64');
    if (!imageBuffer.length || imageBuffer.length > 2 * 1024 * 1024 || imageBuffer.toString('base64') !== imageData || !imageType.signature(imageBuffer)) {
      return res.status(400).json({ success: false, error: 'Image must be a valid JPEG, PNG, or WebP file no larger than 2 MB.' });
    }
    const agencyId = res.locals.budpayUser.agencyId;
    imagePath = await uploadMarketplacePortfolioImage({ agencyId, imageBuffer, mimeType, extension: imageType.extension });
    const item = await addMarketplacePortfolioItem({ agencyId, title: title.trim(), category: category.trim(), description: description.trim(), imagePath });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    if (imagePath) await deleteMarketplacePortfolioImage(imagePath).catch(() => {});
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/marketplace/portfolio/:id', async (req, res) => {
  try {
    if (res.locals.budpayUser?.role !== 'boss') return res.status(403).json({ success: false, error: 'Only the agency boss can remove portfolio work.' });
    const item = await deleteMarketplacePortfolioItem(req.params.id, res.locals.budpayUser.agencyId);
    if (!item) return res.status(404).json({ success: false, error: 'Portfolio item not found.' });
    await deleteMarketplacePortfolioImage(item.imagePath);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/marketplace/services', async (req, res) => {
  try {
    if (res.locals.budpayUser?.role !== 'boss') {
      return res.status(403).json({ success: false, error: 'Only the agency boss can publish services.' });
    }
    if (!requireStorage(res)) return;
    const { title, category, description, price, turnaround } = req.body || {};
    if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 120) {
      return res.status(400).json({ success: false, error: 'Service name must be 3 to 120 characters.' });
    }
    if (typeof category !== 'string' || category.trim().length < 2 || category.trim().length > 100) {
      return res.status(400).json({ success: false, error: 'Category must be 2 to 100 characters.' });
    }
    if (typeof description !== 'string' || description.trim().length < 20 || description.trim().length > 1000) {
      return res.status(400).json({ success: false, error: 'Description must be 20 to 1000 characters.' });
    }
    if (typeof turnaround !== 'string' || turnaround.trim().length < 2 || turnaround.trim().length > 80) {
      return res.status(400).json({ success: false, error: 'Turnaround must be 2 to 80 characters.' });
    }
    const priceCents = moneyToCents(price, 'Service price');
    if (priceCents < 1) return res.status(400).json({ success: false, error: 'Service price must be at least one cent.' });
    const agencyName = res.locals.budpayUser.agency.name;
    const initials = agencyName.split(/\s+/).map(part => part[0]).join('').slice(0, 4).toUpperCase();
    const service = await addMarketplaceService({
      id: crypto.randomUUID(),
      agencyId: res.locals.budpayUser.agencyId,
      agencyName,
      category: category.trim(),
      title: title.trim(),
      description: description.trim(),
      priceCents,
      turnaround: turnaround.trim(),
      initials
    });
    res.status(201).json({ success: true, data: service });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/marketplace/bookings', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    const { serviceId, customerName, customerEmail, notes = '' } = req.body || {};
    const service = await getMarketplaceService(serviceId, MARKETPLACE_SERVICES);
    if (!service) return res.status(404).json({ success: false, error: 'That service is no longer available.' });
    if (service.agencyId === 'tundestudio' && process.env.BUDPAY_AGENCY_NAME?.trim()) {
      service.agencyName = process.env.BUDPAY_AGENCY_NAME.trim();
    }
    if (typeof customerName !== 'string' || customerName.trim().length < 2 || customerName.trim().length > 100) {
      return res.status(400).json({ success: false, error: 'Enter your name (2 to 100 characters).' });
    }
    if (typeof customerEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim()) || customerEmail.trim().length > 255) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    }
    if (typeof notes !== 'string' || notes.trim().length > 1000) {
      return res.status(400).json({ success: false, error: 'Notes must be 1000 characters or fewer.' });
    }

    const bookingId = crypto.randomUUID();
    const frontendOrigin = process.env.PAYPAL_RETURN_URL || 'http://localhost:3000';
    const returnUrl = new URL('/marketplace', frontendOrigin);
    returnUrl.searchParams.set('payment', 'return');
    returnUrl.searchParams.set('bookingId', bookingId);
    const cancelUrl = new URL('/marketplace', frontendOrigin);
    cancelUrl.searchParams.set('payment', 'cancel');
    cancelUrl.searchParams.set('bookingId', bookingId);
    const amount = service.priceCents / 100;
    const order = await createOrder({ amount, currency: 'USD', description: service.title, returnUrl: returnUrl.toString(), cancelUrl: cancelUrl.toString() });
    const approvalUrl = order.links?.find(link => link.rel === 'approve')?.href;
    if (!approvalUrl) throw new Error('PayPal did not return an approval link.');
    const job = await createJob({
      id: bookingId,
      title: service.title,
      customerNotes: notes.trim(),
      totalCustomerPaymentCents: service.priceCents,
      materialCostsCents: 0,
      bossShareCents: 0,
      crewPileCents: service.priceCents,
      paypalOrderId: order.id,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      serviceId: service.id,
      agencyId: service.agencyId,
      agencyName: service.agencyName,
      customerStatus: 'awaiting_payment'
    });
    res.status(201).json({ success: true, bookingId: job.id, orderId: order.id, approvalUrl, service });
  } catch (err) {
    console.error('Marketplace Booking Error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/marketplace/bookings/:jobId/capture', async (req, res) => {
  try {
    if (!requireStorage(res)) return;
    const job = await getJob(req.params.jobId);
    if (!job?.serviceId || !job.paypalOrderId) {
      return res.status(404).json({ success: false, error: 'Marketplace booking was not found.' });
    }
    const paypalToken = typeof req.body?.paypalToken === 'string' ? req.body.paypalToken : '';
    if (!paypalToken || paypalToken !== job.paypalOrderId) {
      return res.status(400).json({ success: false, error: 'The PayPal return does not match this booking.' });
    }
    const booking = (savedJob) => ({
      id: savedJob.id,
      title: savedJob.title,
      agencyName: savedJob.agencyName,
      totalCustomerPaymentCents: savedJob.totalCustomerPaymentCents,
      customerStatus: savedJob.customerStatus
    });
    if (job.paymentCaptured) return res.json({ success: true, status: 'COMPLETED', bookingId: job.id, alreadyCaptured: true, booking: booking(job) });

    const details = await getOrderDetails(job.paypalOrderId);
    if (!['APPROVED', 'COMPLETED'].includes(details.status)) {
      return res.status(409).json({ success: false, error: 'Approve the PayPal order before confirming payment.', status: details.status });
    }
    const orderAmount = details.purchase_units?.[0]?.amount;
    if (orderAmount?.currency_code !== 'USD' || moneyToCents(orderAmount.value, 'PayPal order amount') !== job.totalCustomerPaymentCents) {
      return res.status(409).json({ success: false, error: 'PayPal order amount does not match this booking.' });
    }
    const capture = details.status === 'COMPLETED' ? details : await captureOrder(job.paypalOrderId);
    if (capture.status !== 'COMPLETED') {
      return res.status(409).json({ success: false, error: `PayPal capture is ${capture.status || 'not completed'}.`, status: capture.status });
    }
    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    if (!captureId) throw new Error('PayPal completed the order without returning a capture ID.');
    const savedJob = await updateJobPayment(job.id, { paypalOrderId: job.paypalOrderId, paypalCaptureId: captureId });
    res.json({ success: true, status: capture.status, bookingId: job.id, booking: booking(savedJob) });
  } catch (err) {
    console.error('Marketplace Capture Error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/marketplace/bookings/lookup', async (req, res) => {
  try {
    const { bookingId, customerEmail } = req.body || {};
    if (typeof bookingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId) ||
        typeof customerEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim()) || customerEmail.trim().length > 255) {
      return res.status(404).json({ success: false, error: 'We could not find a booking with those details.' });
    }
    const booking = await findMarketplaceBooking(bookingId, customerEmail.trim());
    if (!booking) return res.status(404).json({ success: false, error: 'We could not find a booking with those details.' });
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('Marketplace Booking Lookup Error:', err.message);
    res.status(500).json({ success: false, error: 'Could not look up your booking right now. Please try again.' });
  }
});

app.put('/api/marketplace/bookings/:jobId/status', async (req, res) => {
  try {
    if (res.locals.budpayUser?.role !== 'boss') {
      return res.status(403).json({ success: false, error: 'Only the agency boss can update booking progress.' });
    }
    const { status } = req.body || {};
    if (!['in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Choose a valid booking progress status.' });
    }
    const job = await updateMarketplaceCustomerStatus(req.params.jobId, status, res.locals.budpayUser.agencyId);
    res.json({ success: true, data: { id: job.id, customerStatus: job.customerStatus } });
  } catch (err) {
    const statusCode = err.message.includes('not found') ? 404 : 409;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

app.get('/api/presets', (req, res) => {
  res.json({ success: true, data: DYNAMIC_PRESETS });
});

app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await getAllJobs(res.locals.budpayUser.agencyId);
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/jobs/:jobId', async (req, res) => {
  try {
    const job = await getJob(req.params.jobId, res.locals.budpayUser.agencyId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found.' });
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/learning/habits', async (req, res) => {
  try {
    res.json({ success: true, data: await getLearnedCrewHabits(res.locals.budpayUser.agencyId) });
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
    const job = await updateJobStory(req.params.jobId, story.trim(), res.locals.budpayUser.agencyId);
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
      crewPileCents: totalCents - costsCents - bossCents, paypalOrderId: order.id,
      agencyId: res.locals.budpayUser.agencyId,
      agencyName: res.locals.budpayUser.agency.name
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
    let job = await getJob(jobId, res.locals.budpayUser.agencyId);
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
    const job = await getAgencyJobByPaypalOrder(req.params.orderId, res.locals.budpayUser.agencyId);
    if (!job) return res.status(404).json({ success: false, error: 'Order not found in this agency workspace.' });
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
    let job = await getJob(jobId, res.locals.budpayUser.agencyId);
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
        await updateJobStory(job.id, story.trim(), res.locals.budpayUser.agencyId);
        await updateJobFinancials(job.id, bossShareCents, res.locals.budpayUser.agencyId);
        job = await getJob(job.id, res.locals.budpayUser.agencyId);
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
      const savedPeople = await findPeopleByIds(requestedIds, res.locals.budpayUser.agencyId);
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
        await updateJobStatus(job.id, 'reviewed', { allocations: calculation.allocations }, res.locals.budpayUser.agencyId);
        job = await updateJobStatus(job.id, 'approved', { allocations: calculation.allocations }, res.locals.budpayUser.agencyId);
      } else if (job.status === 'reviewed') {
        job = await updateJobStatus(job.id, 'approved', { allocations: calculation.allocations }, res.locals.budpayUser.agencyId);
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
        await repairClaimedPayoutRequest(job.id, senderBatchId, payoutRequest, res.locals.budpayUser.agencyId);
      } else {
        await claimJobForPayout(job.id, senderBatchId, payoutRequest, res.locals.budpayUser.agencyId);
      }
    }

    const paypalResult = await createBatchPayout({
      payoutItems: payoutRequest.payoutItems,
      emailSubject: payoutRequest.emailSubject,
      emailMessage: payoutRequest.emailMessage,
      customBatchId: senderBatchId
    });

    await recordPayout({ jobId: job.id, batchId: paypalResult.batchId, allocations: payoutRequest.allocations, agencyId: res.locals.budpayUser.agencyId });
    await updateJobStatus(job.id, 'sent', {
      paypalPayoutBatchId: paypalResult.batchId,
      paypalSenderBatchId: senderBatchId
    }, res.locals.budpayUser.agencyId);

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
    if (!await hasAgencyPayoutBatch(req.params.batchId, res.locals.budpayUser.agencyId)) {
      return res.status(404).json({ success: false, error: 'Payout batch not found in this agency workspace.' });
    }
    const status = await getPayoutStatus(req.params.batchId);
    if (Array.isArray(status.items)) {
      try { await updatePayoutStatuses(req.params.batchId, status.items, res.locals.budpayUser.agencyId); }
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
