import '../env-bootstrap.js';
import crypto from 'crypto';

const rawUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// PostgREST REST requires an HTTPS endpoint (e.g. https://<project-ref>.supabase.co) and a service key
export const isPersistentStoreConfigured = Boolean(
  rawUrl &&
  rawUrl.startsWith('https://') &&
  serviceKey
);

  const supabaseUrl = isPersistentStoreConfigured ? rawUrl : null;

  // ========================================================
  // In-memory preview data; money flows require persistent Supabase storage.
  // ========================================================
  const inMemoryJobs = new Map();
  const inMemoryPayouts = new Map();
  const inMemoryEvents = [];

  const DEFAULT_PEOPLE = [
    { id: 'person_tola', name: 'Tola', role: 'Sewing / Tailor', email: 'sb-nzegj53708550@personal.example.com', default_job_weight: 1.5 },
    { id: 'person_bisi', name: 'Bisi', role: 'Finishing & Embroidery', email: 'bisi@sandbox.example.com', default_job_weight: 2.0 },
    { id: 'person_kunle', name: 'Kunle', role: 'Delivery Rider', email: 'kunle@sandbox.example.com', default_job_weight: 1.0 },
    { id: 'person_ayo', name: 'Chef Ayo', role: 'Catering & Grill', email: 'ayo@sandbox.example.com', default_job_weight: 1.5 },
    { id: 'person_bola', name: 'Bola', role: 'Service & Drinks', email: 'bola@sandbox.example.com', default_job_weight: 1.0 }
  ];

  async function requestTable(table, { method = 'GET', query = '', body, prefer = 'return=representation' } = {}) {
    if (!isPersistentStoreConfigured) {
      throw new Error('Supabase is not configured.');
    }
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: prefer
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) {
      const detail = data?.message || data?.details || data?.hint || text || response.statusText;
      throw new Error(`Supabase ${table} request failed (${response.status}): ${detail}`);
    }
    return data;
  }

  function mapJob(row) {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      rawStory: row.raw_story || '',
      totalCustomerPaymentCents: Number(row.total_customer_payment_cents),
      materialCostsCents: Number(row.material_costs_cents),
      bossShareCents: Number(row.boss_share_cents),
      crewPileCents: Number(row.crew_pile_cents),
      status: row.status,
      paypalOrderId: row.paypal_order_id,
      paypalCaptureId: row.paypal_capture_id,
      paymentCaptured: Boolean(row.payment_captured),
      paypalPayoutBatchId: row.paypal_payout_batch_id,
      paypalSenderBatchId: row.paypal_sender_batch_id,
      paypalClaimedAt: row.paypal_claimed_at,
      payoutRequest: row.payout_request,
      reviewSnapshot: row.review_snapshot,
      createdAt: row.created_at,
      approvedAt: row.approved_at,
      sentAt: row.sent_at
    };
  }

  function mapPerson(row) {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      email: row.email,
      defaultWeight: Number(row.default_job_weight || 1)
    };
  }

  async function writeEvent(jobId, event, details = {}) {
    if (isPersistentStoreConfigured) {
      try {
        await requestTable('job_events', {
          method: 'POST',
          body: { job_id: jobId, event, details }
        });
        return;
      } catch (e) {
        console.warn('Could not persist job event to Supabase:', e.message);
      }
    }
    inMemoryEvents.push({ jobId, event, details, timestamp: new Date().toISOString() });
  }

  export async function createJob({
    title = 'Custom Job', rawStory = '', totalCustomerPaymentCents,
    materialCostsCents = 0, bossShareCents = 0, crewPileCents,
    paypalOrderId
  }) {
    const id = crypto.randomUUID();
  const calculatedCrewPile = crewPileCents !== undefined
          ? crewPileCents
          : (totalCustomerPaymentCents - materialCostsCents - bossShareCents);

        if(isPersistentStoreConfigured) {
          const rows = await requestTable('jobs', {
            method: 'POST',
            body: {
              id, title, raw_story: rawStory,
              total_customer_payment_cents: totalCustomerPaymentCents,
              material_costs_cents: materialCostsCents,
              boss_share_cents: bossShareCents,
              crew_pile_cents: calculatedCrewPile,
              paypal_order_id: paypalOrderId || null,
              payment_captured: false,
              status: 'draft'
            }
          });
          const job = mapJob(rows?.[0]);
          if (job) {
            await writeEvent(job.id, 'draft_created', { paypalOrderId });
            return job;
          }
        throw new Error('Supabase did not return the created job.');
    }

  // In-Memory Mode
  const memoryJob = {
    id,
    title,
    raw_story: rawStory,
    total_customer_payment_cents: totalCustomerPaymentCents,
    material_costs_cents: materialCostsCents,
    boss_share_cents: bossShareCents,
    crew_pile_cents: calculatedCrewPile,
    paypal_order_id: paypalOrderId || null,
    paypal_capture_id: null,
    payment_captured: false,
    status: 'draft',
    created_at: new Date().toISOString()
  };
  inMemoryJobs.set(id, memoryJob);
  await writeEvent(id, 'draft_created', { paypalOrderId });
  return mapJob(memoryJob);
}

export async function getJob(jobId) {
  if (!jobId) return null;
  if (isPersistentStoreConfigured) {
    try {
      const rows = await requestTable('jobs', { query: `id=eq.${encodeURIComponent(jobId)}&select=*` });
      if (rows?.[0]) return mapJob(rows[0]);
    } catch (e) {
      throw new Error(`Could not load job from Supabase: ${e.message}`);
    }
    return null;
  }
  return mapJob(inMemoryJobs.get(jobId));
}

export async function updateJobPayment(jobId, { paypalOrderId, paypalCaptureId }) {
    if (isPersistentStoreConfigured) {
      try {
        const rows = await requestTable('jobs', {
          method: 'PATCH',
          query: `id=eq.${encodeURIComponent(jobId)}&paypal_order_id=eq.${encodeURIComponent(paypalOrderId)}&payment_captured=eq.false`,
          body: { payment_captured: true, paypal_capture_id: paypalCaptureId }
        });
        const job = mapJob(rows?.[0]);
        if (job) {
          await writeEvent(job.id, 'customer_payment_captured', { paypalOrderId, paypalCaptureId });
          return job;
        }
      } catch (e) {
        throw new Error(`Could not save customer payment in Supabase: ${e.message}`);
      }
      throw new Error('Job payment was not updated; verify the order and job are still pending.');
    }

    const job = inMemoryJobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    job.payment_captured = true;
    job.paypal_capture_id = paypalCaptureId;
    await writeEvent(jobId, 'customer_payment_captured', { paypalOrderId, paypalCaptureId });
    return mapJob(job);
  }

  export async function updateJobStatus(jobId, newStatus, metadata = {}) {
    const job = await getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    const validTransitions = {
      draft: ['reviewed'], reviewed: ['approved', 'draft'],
      approved: ['sent', 'reviewed'], sent: []
    };
    if (!(validTransitions[job.status] || []).includes(newStatus)) {
      throw new Error(`Invalid status transition from ${job.status} to ${newStatus}`);
    }

    const patch = { status: newStatus };
    if (newStatus === 'reviewed' && metadata.allocations) patch.review_snapshot = metadata.allocations;
    if (newStatus === 'approved') patch.approved_at = new Date().toISOString();
    if (newStatus === 'sent') patch.sent_at = new Date().toISOString();
    if (metadata.paypalPayoutBatchId) patch.paypal_payout_batch_id = metadata.paypalPayoutBatchId;
    if (metadata.paypalSenderBatchId) patch.paypal_sender_batch_id = metadata.paypalSenderBatchId;

    if (isPersistentStoreConfigured) {
      try {
        const rows = await requestTable('jobs', {
          method: 'PATCH',
          query: `id=eq.${encodeURIComponent(jobId)}&status=eq.${encodeURIComponent(job.status)}`,
          body: patch
        });
        if (rows?.[0]) {
          await writeEvent(jobId, `status_${newStatus}`, metadata);
          return mapJob(rows[0]);
        }
      } catch (e) {
        throw new Error(`Could not update job status in Supabase: ${e.message}`);
      }
      throw new Error(`Job status changed before it could be updated to ${newStatus}.`);
    }

    const mem = inMemoryJobs.get(jobId);
    if (mem) {
      Object.assign(mem, patch);
    }
    await writeEvent(jobId, `status_${newStatus}`, metadata);
    return mapJob(mem || { ...job, ...patch });
  }

  export async function claimJobForPayout(jobId, senderBatchId, payoutRequest) {
    if (isPersistentStoreConfigured) {
      try {
        const rows = await requestTable('jobs', {
          method: 'PATCH',
          query: `id=eq.${encodeURIComponent(jobId)}&status=eq.approved&payment_captured=eq.true&paypal_sender_batch_id=is.null`,
          body: { paypal_sender_batch_id: senderBatchId, paypal_claimed_at: new Date().toISOString(), payout_request: payoutRequest }
        });
        if (rows?.[0]) {
          await writeEvent(jobId, 'payout_claimed', { senderBatchId, allocations: payoutRequest.allocations });
          return mapJob(rows[0]);
        }
      } catch (e) {
        throw new Error(`Could not claim payout in Supabase: ${e.message}`);
      }
      throw new Error('This job is not approved for payout or has already been claimed.');
    }

    const job = inMemoryJobs.get(jobId);
    if (job) {
      if (job.status !== 'approved' || !job.payment_captured) {
        throw new Error('Only a paid, approved job can be claimed for payout.');
      }
      if (job.paypal_sender_batch_id) {
        throw new Error('This job is already being paid or has already been paid.');
      }
      job.paypal_sender_batch_id = senderBatchId;
      job.paypal_claimed_at = new Date().toISOString();
      job.payout_request = payoutRequest;
      await writeEvent(jobId, 'payout_claimed', { senderBatchId, allocations: payoutRequest.allocations });
      return mapJob(job);
    }

    throw new Error(`Job not found: ${jobId}`);
  }

export async function repairClaimedPayoutRequest(jobId, senderBatchId, payoutRequest) {
  const job = await getJob(jobId);
  if (!job || job.status !== 'approved' || !job.paymentCaptured || job.paypalSenderBatchId !== senderBatchId) {
    throw new Error('The claimed payout cannot be repaired because the job state changed.');
  }
  const existingItems = job.payoutRequest?.payoutItems;
  const hasValidRecipients = Array.isArray(existingItems) && existingItems.length > 0 && existingItems.every(item =>
    typeof item.recipientEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.recipientEmail)
  );
  if (hasValidRecipients) {
    throw new Error('The saved payout request already has recipients and cannot be replaced.');
  }

  if (isPersistentStoreConfigured) {
    try {
      const rows = await requestTable('jobs', {
        method: 'PATCH',
        query: `id=eq.${encodeURIComponent(jobId)}&status=eq.approved&payment_captured=eq.true&paypal_sender_batch_id=eq.${encodeURIComponent(senderBatchId)}`,
        body: { payout_request: payoutRequest }
      });
      if (rows?.[0]) {
        await writeEvent(jobId, 'payout_request_repaired', { senderBatchId, recipients: payoutRequest.payoutItems.length });
        return mapJob(rows[0]);
      }
      throw new Error('The claimed payout changed before it could be repaired.');
    } catch (e) {
      throw new Error(`Could not repair claimed payout in Supabase: ${e.message}`);
    }
  }

  const memoryJob = inMemoryJobs.get(jobId);
  if (!memoryJob || memoryJob.paypal_sender_batch_id !== senderBatchId) {
    throw new Error('The claimed payout changed before it could be repaired.');
  }
  memoryJob.payout_request = payoutRequest;
  await writeEvent(jobId, 'payout_request_repaired', { senderBatchId, recipients: payoutRequest.payoutItems.length });
  return mapJob(memoryJob);
}

  export async function recordPayout({ jobId, batchId, allocations }) {
    const rows = allocations.map(alloc => ({
      job_id: jobId,
      person_id: alloc.personId || null,
      recipient_email: alloc.email,
      role: alloc.role || alloc.job,
      hours: alloc.hours,
      weight: alloc.jobWeight,
      points: alloc.points,
      amount_cents: alloc.amountCents,
      reason: alloc.reason || '',
      thank_you_note: alloc.thankYouNote || alloc.thankYouNoteDraft || '',
      paypal_payout_batch_id: batchId,
      status: 'pending'
    }));

    if (isPersistentStoreConfigured) {
      try {
        await requestTable('payouts', { method: 'POST', body: rows, prefer: 'resolution=ignore-duplicates,return=representation' });
        await writeEvent(jobId, 'payout_batch_submitted', { batchId, recipients: rows.length });
        return;
      } catch (e) {
        throw new Error(`Could not record payout in Supabase: ${e.message}`);
      }
      return;
    }

    inMemoryPayouts.set(batchId, rows);
    await writeEvent(jobId, 'payout_batch_submitted', { batchId, recipients: rows.length });
  }

  export async function getSavedPeople() {
    if (isPersistentStoreConfigured) {
      try {
        const rows = await requestTable('people', { query: 'select=*&active=eq.true&order=name.asc' });
        return (rows || []).map(mapPerson);
      } catch (e) {
        throw new Error(`Could not load crew roster from Supabase: ${e.message}`);
      }
    }
    return DEFAULT_PEOPLE.map(mapPerson);
  }

  export async function findPeopleByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    if (isPersistentStoreConfigured) {
      try {
        const list = ids.map(id => `"${String(id).replaceAll('"', '')}"`).join(',');
        const rows = await requestTable('people', { query: `select=*&active=eq.true&id=in.(${encodeURIComponent(list)})` });
        return (rows || []).map(mapPerson);
      } catch (e) {
        throw new Error(`Could not verify crew roster in Supabase: ${e.message}`);
      }
    }
    return DEFAULT_PEOPLE.filter(p => ids.includes(p.id) || ids.includes(p.name)).map(mapPerson);
  }

  export async function updateJobFinancials(jobId, bossShareCents) {
    if (!Number.isSafeInteger(bossShareCents) || bossShareCents < 0 || bossShareCents > 2147483647) throw new Error("Boss's share must be whole cents within the supported storage range.");
    const job = await getJob(jobId);
    if (!job || job.status !== 'draft') throw new Error('Only a draft job can have its share changed.');
    const crewPileCents = job.totalCustomerPaymentCents - job.materialCostsCents - bossShareCents;
    if (crewPileCents < 0) throw new Error("Boss's share and costs cannot exceed the customer payment.");

    if (isPersistentStoreConfigured) {
      try {
        const rows = await requestTable('jobs', {
          method: 'PATCH',
          query: `id=eq.${encodeURIComponent(jobId)}&status=eq.draft`,
          body: { boss_share_cents: bossShareCents, crew_pile_cents: crewPileCents }
        });
        if (rows?.[0]) {
          await writeEvent(jobId, 'boss_share_updated', { bossShareCents, crewPileCents });
          return mapJob(rows[0]);
        }
      } catch (e) {
        throw new Error(`Could not save boss share in Supabase: ${e.message}`);
      }
      throw new Error('Job financials could not be updated because the job is no longer a draft.');
    }

    const mem = inMemoryJobs.get(jobId);
    if (mem) {
      mem.boss_share_cents = bossShareCents;
      mem.crew_pile_cents = crewPileCents;
    }
    await writeEvent(jobId, 'boss_share_updated', { bossShareCents, crewPileCents });
    return mapJob(mem || { ...job, bossShareCents, crewPileCents });
  }

  export async function updatePayoutStatuses(batchId, items) {
    for (const item of items || []) {
      const email = item.payout_item?.receiver;
      if (!email) continue;
      const paypalStatus = String(item.transaction_status || '').toUpperCase();
      const status = paypalStatus === 'SUCCESS' ? 'success'
        : ['FAILED', 'BLOCKED', 'DENIED', 'CANCELED', 'REFUNDED', 'RETURNED', 'UNCLAIMED'].includes(paypalStatus) ? 'failed'
          : 'pending';
      const itemId = item.payout_item_id || item.payout_item?.payout_item_id || null;

        if (isPersistentStoreConfigured) {
          try {
            const query = `paypal_payout_batch_id=eq.${encodeURIComponent(batchId)}&recipient_email=eq.${encodeURIComponent(email)}`;
            const existing = await requestTable('payouts', { query: `${query}&select=job_id,status` });
            await requestTable('payouts', {
              method: 'PATCH', query,
              body: { status, paypal_payout_item_id: itemId }
            });
            if (existing?.[0] && existing[0].status !== status) {
              await writeEvent(existing[0].job_id, `payout_item_${status}`, { batchId, email, paypalStatus });
            }
          } catch (e) {
            console.warn('Supabase updatePayoutStatuses error:', e.message);
          }
        }

        const memoryBatch = inMemoryPayouts.get(batchId);
        if (memoryBatch) {
          const match = memoryBatch.find(m => m.recipient_email === email);
          if (match) match.status = status;
        }
      }
    }

    export async function updateJobStory(jobId, rawStory) {
      const job = await getJob(jobId);
      if (!job || job.status !== 'draft') throw new Error('Story can only be saved to a draft job.');

      if (isPersistentStoreConfigured) {
        try {
          const rows = await requestTable('jobs', {
            method: 'PATCH',
            query: `id=eq.${encodeURIComponent(jobId)}&status=eq.draft`,
            body: { raw_story: rawStory }
          });
          if (rows?.[0]) {
            await writeEvent(jobId, 'story_saved', { rawStory });
            return mapJob(rows[0]);
          }
      } catch (e) {
        throw new Error(`Could not save job story in Supabase: ${e.message}`);
      }
      throw new Error('Job story could not be updated because the job is no longer a draft.');
      }

      const mem = inMemoryJobs.get(jobId);
      if (mem) {
        mem.raw_story = rawStory;
      }
      await writeEvent(jobId, 'story_saved', { rawStory });
      return mapJob(mem || { ...job, rawStory });
    }

    export async function addSavedPerson({ name, role, email, defaultWeight = 1.0 }) {
      const id = crypto.randomUUID();
      if (isPersistentStoreConfigured) {
        try {
          const rows = await requestTable('people', {
            method: 'POST',
            body: { id, name, role, email, default_job_weight: defaultWeight, active: true }
          });
          if (rows?.[0]) return mapPerson(rows[0]);
          throw new Error('Supabase did not return the saved crew member.');
        } catch (e) {
          throw new Error(`Could not save crew member in Supabase: ${e.message}`);
        }
      }
      const person = { id, name, role, email, default_job_weight: defaultWeight };
      DEFAULT_PEOPLE.push(person);
      return mapPerson(person);
    }

    export async function updateSavedPerson(personId, { name, role, email, defaultWeight }) {
      if (isPersistentStoreConfigured) {
        try {
          const rows = await requestTable('people', {
            method: 'PATCH',
            query: `id=eq.${encodeURIComponent(personId)}&active=eq.true`,
            body: { name, role, email, default_job_weight: defaultWeight }
          });
          if (rows?.[0]) return mapPerson(rows[0]);
          throw new Error('Crew member not found or inactive.');
        } catch (e) {
          throw new Error(`Could not update crew member in Supabase: ${e.message}`);
        }
      }

      const person = DEFAULT_PEOPLE.find(item => item.id === personId);
      if (!person) throw new Error('Crew member not found.');
      Object.assign(person, { name, role, email, default_job_weight: defaultWeight });
      return mapPerson(person);
    }

    export async function getAllJobs() {
      if (isPersistentStoreConfigured) {
        try {
          const rows = await requestTable('jobs', { query: 'select=*&order=created_at.desc&limit=50' });
          return (rows || []).map(mapJob);
        } catch (e) {
          throw new Error(`Could not load jobs from Supabase: ${e.message}`);
        }
      }
      return Array.from(inMemoryJobs.values()).map(mapJob).reverse();
    }
