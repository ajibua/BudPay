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
  const inMemoryWorkLogs = new Map();
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
      customerName: row.customer_name || '',
      customerEmail: row.customer_email || '',
      customerNotes: row.customer_notes || '',
      serviceId: row.service_id || '',
      agencyId: row.agency_id || '',
      agencyName: row.agency_name || '',
      customerStatus: row.customer_status === 'not_applicable' && row.service_id && row.payment_captured
        ? 'paid'
        : (row.customer_status || (row.service_id ? 'awaiting_payment' : 'not_applicable')),
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

  function mapMarketplaceService(row) {
    return {
      id: row.id,
      agencyId: row.agency_id,
      agencyName: row.agency_name,
      category: row.category,
      title: row.title,
      description: row.description,
      priceCents: Number(row.price_cents),
      turnaround: row.turnaround,
      initials: row.initials || 'BP'
    };
  }

  function mapPerson(row) {
    return {
      id: row.id,
      agencyId: row.agency_id || '',
      name: row.name,
      role: row.role,
      email: row.email,
      authEmail: row.auth_email || row.email,
      defaultWeight: Number(row.default_job_weight || 1)
    };
  }

  function mapWorkLog(row) {
    if (!row) return null;
    const person = Array.isArray(row.people) ? row.people[0] : row.people;
    return {
      id: row.id,
      personId: row.person_id,
      personName: person?.name || row.personName || '',
      personRole: person?.role || row.personRole || '',
      workDate: row.work_date,
      task: row.task,
      hours: Number(row.hours),
      details: row.details || '',
      status: row.status,
      reviewNote: row.review_note || '',
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at || null
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
    paypalOrderId, customerName = '', customerEmail = '', customerNotes = '',
    serviceId = '', agencyId = '', agencyName = '', id: requestedId, customerStatus = 'not_applicable'
  }) {
    const id = requestedId || crypto.randomUUID();
  const calculatedCrewPile = crewPileCents !== undefined
          ? crewPileCents
          : (totalCustomerPaymentCents - materialCostsCents - bossShareCents);

        if(isPersistentStoreConfigured) {
          const rows = await requestTable('jobs', {
            method: 'POST',
            body: {
              id, title, raw_story: rawStory,
              customer_name: customerName,
              customer_email: customerEmail,
              customer_notes: customerNotes,
              service_id: serviceId || null,
              agency_id: agencyId || null,
              agency_name: agencyName,
              customer_status: customerStatus,
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
    customer_name: customerName,
    customer_email: customerEmail,
    customer_notes: customerNotes,
    service_id: serviceId || null,
    agency_id: agencyId || null,
    agency_name: agencyName,
    customer_status: customerStatus,
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

function normalizeHabitRole(role) {
  return String(role || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function getJob(jobId, agencyId = null) {
  if (!jobId) return null;
  if (isPersistentStoreConfigured) {
    try {
      const agencyFilter = agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : '';
      const rows = await requestTable('jobs', { query: `id=eq.${encodeURIComponent(jobId)}${agencyFilter}&select=*` });
      if (rows?.[0]) return mapJob(rows[0]);
    } catch (e) {
      throw new Error(`Could not load job from Supabase: ${e.message}`);
    }
    return null;
  }
  return mapJob(inMemoryJobs.get(jobId));
}

export async function updateJobPayment(jobId, { paypalOrderId, paypalCaptureId }) {
    const existingJob = await getJob(jobId);
    if (isPersistentStoreConfigured) {
      try {
        const rows = await requestTable('jobs', {
          method: 'PATCH',
          query: `id=eq.${encodeURIComponent(jobId)}&paypal_order_id=eq.${encodeURIComponent(paypalOrderId)}&payment_captured=eq.false`,
          body: {
            payment_captured: true,
            paypal_capture_id: paypalCaptureId,
            ...(existingJob?.serviceId ? { customer_status: 'paid' } : {})
          }
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
    if (job.service_id) job.customer_status = 'paid';
    await writeEvent(jobId, 'customer_payment_captured', { paypalOrderId, paypalCaptureId });
    return mapJob(job);
  }

export async function updateMarketplaceCustomerStatus(jobId, newStatus, agencyId = null) {
  const job = await getJob(jobId, agencyId);
  if (!job?.serviceId || !job.paymentCaptured) throw new Error('Paid marketplace booking not found.');
  const transitions = { paid: ['in_progress'], in_progress: ['completed'], completed: [] };
  if (!(transitions[job.customerStatus] || []).includes(newStatus)) {
    throw new Error(`Booking cannot move from ${job.customerStatus} to ${newStatus}.`);
  }

  if (isPersistentStoreConfigured) {
    try {
      const rows = await requestTable('jobs', {
        method: 'PATCH',
        query: `id=eq.${encodeURIComponent(jobId)}${agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : ''}&service_id=not.is.null&payment_captured=eq.true&customer_status=eq.${encodeURIComponent(job.customerStatus)}&select=*`,
        body: { customer_status: newStatus }
      });
      if (!rows?.[0]) throw new Error('Booking status changed elsewhere. Refresh and try again.');
      await writeEvent(jobId, 'customer_status_updated', { from: job.customerStatus, to: newStatus });
      return mapJob(rows[0]);
    } catch (e) {
      throw new Error(`Could not update marketplace booking status: ${e.message}`);
    }
  }

  const memoryJob = inMemoryJobs.get(jobId);
  memoryJob.customer_status = newStatus;
  await writeEvent(jobId, 'customer_status_updated', { from: job.customerStatus, to: newStatus });
  return mapJob(memoryJob);
}

export async function findMarketplaceBooking(jobId, customerEmail) {
  const job = await getJob(jobId);
  if (!job?.serviceId || job.customerEmail.toLowerCase() !== customerEmail.toLowerCase()) return null;
  return {
    id: job.id,
    title: job.title,
    agencyName: job.agencyName,
    totalCustomerPaymentCents: job.totalCustomerPaymentCents,
    customerStatus: job.paymentCaptured ? job.customerStatus : 'awaiting_payment',
    paymentCaptured: job.paymentCaptured,
    createdAt: job.createdAt
  };
}

  export async function updateJobStatus(jobId, newStatus, metadata = {}, agencyId = null) {
    const job = await getJob(jobId, agencyId);
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
          query: `id=eq.${encodeURIComponent(jobId)}${agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : ''}&status=eq.${encodeURIComponent(job.status)}`,
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

  export async function claimJobForPayout(jobId, senderBatchId, payoutRequest, agencyId = null) {
    if (isPersistentStoreConfigured) {
      try {
        const rows = await requestTable('jobs', {
          method: 'PATCH',
          query: `id=eq.${encodeURIComponent(jobId)}${agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : ''}&status=eq.approved&payment_captured=eq.true&paypal_sender_batch_id=is.null`,
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

export async function repairClaimedPayoutRequest(jobId, senderBatchId, payoutRequest, agencyId = null) {
  const job = await getJob(jobId, agencyId);
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
        query: `id=eq.${encodeURIComponent(jobId)}${agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : ''}&status=eq.approved&payment_captured=eq.true&paypal_sender_batch_id=eq.${encodeURIComponent(senderBatchId)}`,
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

  export async function recordPayout({ jobId, batchId, allocations, agencyId = null }) {
    const rows = allocations.map(alloc => ({
      job_id: jobId,
      agency_id: agencyId,
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

  export async function getSavedPeople(agencyId = null) {
    if (isPersistentStoreConfigured) {
      try {
        const agencyFilter = agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : '';
        const rows = await requestTable('people', { query: `select=*&active=eq.true&order=name.asc${agencyFilter}` });
        return (rows || []).map(mapPerson);
      } catch (e) {
        throw new Error(`Could not load crew roster from Supabase: ${e.message}`);
      }
    }
    return DEFAULT_PEOPLE.filter(person => person.active !== false).map(mapPerson);
  }

  export async function getCrewPersonByEmail(email, agencyId = null) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return null;
    const people = await getSavedPeople(agencyId);
    return people.find(person => (person.authEmail || person.email).trim().toLowerCase() === normalizedEmail) || null;
  }

  export async function deactivateSavedPerson(personId, agencyId = null) {
    if (isPersistentStoreConfigured) {
      const rows = await requestTable('people', {
        method: 'PATCH',
        query: `id=eq.${encodeURIComponent(personId)}&active=eq.true${agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : ''}`,
        body: { active: false }
      });
      if (!rows?.[0]) throw new Error('Crew member not found or already inactive.');
      return mapPerson(rows[0]);
    }
    const person = DEFAULT_PEOPLE.find(item => item.id === personId && item.active !== false);
    if (!person) throw new Error('Crew member not found or already inactive.');
    person.active = false;
    return mapPerson(person);
  }

  export async function getWorkLogs({ personId, agencyId } = {}) {
    if (isPersistentStoreConfigured) {
      const filter = `${personId ? `&person_id=eq.${encodeURIComponent(personId)}` : ''}${agencyId ? `&people.agency_id=eq.${encodeURIComponent(agencyId)}` : ''}`;
      const rows = await requestTable('work_logs', {
        query: `select=*,people${agencyId ? '!inner' : ''}(id,name,role)&order=submitted_at.desc${filter}`
      });
      return (rows || []).map(mapWorkLog);
    }
    return Array.from(inMemoryWorkLogs.values())
      .filter(log => !personId || log.person_id === personId)
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
      .map(mapWorkLog);
  }

  export async function createWorkLog({ personId, workDate, task, hours, details }) {
    const id = crypto.randomUUID();
    const submittedAt = new Date().toISOString();
    if (isPersistentStoreConfigured) {
      const rows = await requestTable('work_logs', {
        method: 'POST',
        body: {
          id,
          person_id: personId,
          work_date: workDate,
          task,
          hours,
          details,
          status: 'pending'
        }
      });
      const log = mapWorkLog(rows?.[0]);
      if (!log) throw new Error('Supabase did not return the submitted work log.');
      return log;
    }

    const person = await getSavedPeople().then(people => people.find(item => item.id === personId));
    const row = {
      id,
      person_id: personId,
      personName: person?.name || '',
      personRole: person?.role || '',
      work_date: workDate,
      task,
      hours,
      details,
      status: 'pending',
      review_note: '',
      submitted_at: submittedAt,
      reviewed_at: null
    };
    inMemoryWorkLogs.set(id, row);
    return mapWorkLog(row);
  }

  export async function reviewWorkLog({ logId, status, reviewNote, reviewerId, agencyId = null }) {
    const reviewedAt = new Date().toISOString();
    if (isPersistentStoreConfigured) {
      if (agencyId) {
        const ownedRows = await requestTable('work_logs', {
          query: `id=eq.${encodeURIComponent(logId)}&people.agency_id=eq.${encodeURIComponent(agencyId)}&select=id,people!inner(agency_id)`
        });
        if (!ownedRows?.[0]) throw new Error('Work log not found or already reviewed.');
      }
      const rows = await requestTable('work_logs', {
        method: 'PATCH',
        query: `id=eq.${encodeURIComponent(logId)}&status=eq.pending&select=*,people(id,name,role)`,
        body: {
          status,
          review_note: reviewNote,
          reviewed_at: reviewedAt,
          reviewed_by: reviewerId
        }
      });
      if (!rows?.[0]) throw new Error('Work log not found or already reviewed.');
      return mapWorkLog(rows[0]);
    }

    const row = inMemoryWorkLogs.get(logId);
    if (!row || row.status !== 'pending') throw new Error('Work log not found or already reviewed.');
    Object.assign(row, { status, review_note: reviewNote, reviewed_at: reviewedAt, reviewed_by: reviewerId });
    return mapWorkLog(row);
  }

  export async function findPeopleByIds(ids, agencyId = null) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    if (isPersistentStoreConfigured) {
      try {
        const list = ids.map(id => `"${String(id).replaceAll('"', '')}"`).join(',');
        const rows = await requestTable('people', { query: `select=*&active=eq.true&id=in.(${encodeURIComponent(list)})${agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : ''}` });
        return (rows || []).map(mapPerson);
      } catch (e) {
        throw new Error(`Could not verify crew roster in Supabase: ${e.message}`);
      }
    }
    return DEFAULT_PEOPLE.filter(p => ids.includes(p.id) || ids.includes(p.name)).map(mapPerson);
  }

  export async function updateJobFinancials(jobId, bossShareCents, agencyId = null) {
    if (!Number.isSafeInteger(bossShareCents) || bossShareCents < 0 || bossShareCents > 2147483647) throw new Error("Boss's share must be whole cents within the supported storage range.");
    const job = await getJob(jobId, agencyId);
    if (!job || job.status !== 'draft') throw new Error('Only a draft job can have its share changed.');
    const crewPileCents = job.totalCustomerPaymentCents - job.materialCostsCents - bossShareCents;
    if (crewPileCents < 0) throw new Error("Boss's share and costs cannot exceed the customer payment.");

    if (isPersistentStoreConfigured) {
      try {
        const rows = await requestTable('jobs', {
          method: 'PATCH',
          query: `id=eq.${encodeURIComponent(jobId)}${agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : ''}&status=eq.draft`,
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

  export async function updatePayoutStatuses(batchId, items, agencyId = null) {
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
            const query = `paypal_payout_batch_id=eq.${encodeURIComponent(batchId)}&recipient_email=eq.${encodeURIComponent(email)}${agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : ''}`;
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

  export async function getLearnedCrewHabits(agencyId = null) {
      let payoutRows;
      if (isPersistentStoreConfigured) {
        try {
          payoutRows = await requestTable('payouts', {
            query: `select=job_id,role,weight,amount_cents,status&order=created_at.desc&limit=5000${agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : ''}`
          });
        } catch (e) {
          throw new Error(`Could not load payout history for habit suggestions: ${e.message}`);
        }
      } else {
        payoutRows = Array.from(inMemoryPayouts.values()).flat();
      }

      const payoutsByJob = new Map();
      for (const payout of payoutRows || []) {
        if (!payout?.job_id) continue;
        const rows = payoutsByJob.get(payout.job_id) || [];
        rows.push(payout);
        payoutsByJob.set(payout.job_id, rows);
      }

      const roleSamples = new Map();
      let completedJobs = 0;
      for (const rows of payoutsByJob.values()) {
        if (!rows.length || rows.some(row => String(row.status).toLowerCase() !== 'success')) continue;
        const crewTotalCents = rows.reduce((sum, row) => sum + Math.max(0, Number(row.amount_cents) || 0), 0);
        if (crewTotalCents <= 0) continue;
        completedJobs += 1;

        const rowsByRole = new Map();
        for (const row of rows) {
          const key = normalizeHabitRole(row.role);
          if (!key) continue;
          const roleRows = rowsByRole.get(key) || [];
          roleRows.push(row);
          rowsByRole.set(key, roleRows);
        }

        for (const [key, roleRows] of rowsByRole) {
          const current = roleSamples.get(key) || {
            role: String(roleRows[0].role).trim(),
            weights: [],
            shares: []
          };
          const averageWeight = roleRows.reduce((sum, row) => sum + (Number(row.weight) || 1), 0) / roleRows.length;
          const roleTotalCents = roleRows.reduce((sum, row) => sum + (Number(row.amount_cents) || 0), 0);
          current.weights.push(averageWeight);
          current.shares.push((roleTotalCents / crewTotalCents) * 100);
          roleSamples.set(key, current);
        }
      }

      const habits = Array.from(roleSamples, ([key, sample]) => {
        const averageWeight = sample.weights.reduce((sum, weight) => sum + weight, 0) / sample.weights.length;
        const roundedWeight = Math.min(2.5, Math.max(1.0, Math.round(averageWeight * 2) / 2));
        const averageSharePercent = sample.shares.reduce((sum, share) => sum + share, 0) / sample.shares.length;
        return {
          key,
          role: sample.role,
          jobCount: sample.weights.length,
          averageWeight: roundedWeight,
          averageSharePercent: Number(averageSharePercent.toFixed(1))
        };
      }).filter(habit => completedJobs >= 3 && habit.jobCount >= 3);

      return { completedJobs, requiredJobs: 3, habits };
    }

    export async function updateJobStory(jobId, rawStory, agencyId = null) {
      const job = await getJob(jobId, agencyId);
      if (!job || job.status !== 'draft') throw new Error('Story can only be saved to a draft job.');

      if (isPersistentStoreConfigured) {
        try {
          const rows = await requestTable('jobs', {
            method: 'PATCH',
            query: `id=eq.${encodeURIComponent(jobId)}${agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : ''}&status=eq.draft`,
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

    export async function addSavedPerson({ name, role, email, authEmail = email, defaultWeight = 1.0, agencyId = null }) {
      const id = crypto.randomUUID();
      if (isPersistentStoreConfigured) {
        try {
          const rows = await requestTable('people', {
            method: 'POST',
            body: { id, agency_id: agencyId, name, role, email, auth_email: authEmail, default_job_weight: defaultWeight, active: true }
          });
          if (rows?.[0]) return mapPerson(rows[0]);
          throw new Error('Supabase did not return the saved crew member.');
        } catch (e) {
          throw new Error(`Could not save crew member in Supabase: ${e.message}`);
        }
      }
      const person = { id, agency_id: agencyId, name, role, email, auth_email: authEmail, default_job_weight: defaultWeight };
      DEFAULT_PEOPLE.push(person);
      return mapPerson(person);
    }

    export async function updateSavedPerson(personId, { name, role, email, authEmail = email, defaultWeight }, agencyId = null) {
      if (isPersistentStoreConfigured) {
        try {
          const rows = await requestTable('people', {
            method: 'PATCH',
            query: `id=eq.${encodeURIComponent(personId)}&active=eq.true${agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : ''}`,
            body: { name, role, email, auth_email: authEmail, default_job_weight: defaultWeight }
          });
          if (rows?.[0]) return mapPerson(rows[0]);
          throw new Error('Crew member not found or inactive.');
        } catch (e) {
          throw new Error(`Could not update crew member in Supabase: ${e.message}`);
        }
      }

      const person = DEFAULT_PEOPLE.find(item => item.id === personId);
      if (!person) throw new Error('Crew member not found.');
      Object.assign(person, { name, role, email, auth_email: authEmail, default_job_weight: defaultWeight });
      return mapPerson(person);
    }

    export async function getAllJobs(agencyId = null) {
      if (isPersistentStoreConfigured) {
        try {
          const rows = await requestTable('jobs', { query: `select=*&order=created_at.desc&limit=50${agencyId ? `&agency_id=eq.${encodeURIComponent(agencyId)}` : ''}` });
          return (rows || []).map(mapJob);
        } catch (e) {
          throw new Error(`Could not load jobs from Supabase: ${e.message}`);
        }
      }
      return Array.from(inMemoryJobs.values()).filter(job => !agencyId || job.agency_id === agencyId).map(mapJob).reverse();
    }

    export async function getMarketplaceServices(fallbackServices = []) {
      if (!isPersistentStoreConfigured) return fallbackServices;
      try {
        const rows = await requestTable('marketplace_services', {
          query: 'select=*&active=eq.true&order=created_at.desc'
        });
        return (rows || []).map(mapMarketplaceService);
      } catch (e) {
        throw new Error(`Could not load marketplace services from Supabase: ${e.message}`);
      }
    }

    export async function getMarketplaceService(serviceId, fallbackServices = []) {
      if (!isPersistentStoreConfigured) return fallbackServices.find(service => service.id === serviceId) || null;
      try {
        const rows = await requestTable('marketplace_services', {
          query: `id=eq.${encodeURIComponent(serviceId)}&active=eq.true&select=*`
        });
        return rows?.[0] ? mapMarketplaceService(rows[0]) : null;
      } catch (e) {
        throw new Error(`Could not load marketplace service from Supabase: ${e.message}`);
      }
    }

  function mapAgency(row) {
    return row ? { id: row.id, name: row.name, slug: row.slug, ownerEmail: row.owner_email || '' } : null;
  }

  export async function getAgencyById(agencyId) {
    if (!agencyId) return null;
    if (!isPersistentStoreConfigured) return agencyId === 'tundestudio' ? { id: 'tundestudio', name: process.env.BUDPAY_AGENCY_NAME?.trim() || "Tunde's Tailoring Studio", slug: 'tunde-studio', ownerEmail: '' } : null;
    const rows = await requestTable('agencies', { query: `id=eq.${encodeURIComponent(agencyId)}&select=*` });
    return mapAgency(rows?.[0]);
  }

  export async function getAgencyForUser(userId, email) {
    if (!isPersistentStoreConfigured) return null;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const userRows = userId
      ? await requestTable('agencies', { query: `owner_user_id=eq.${encodeURIComponent(userId)}&select=*` })
      : [];
    const rows = userRows?.length || !normalizedEmail ? userRows : await requestTable('agencies', { query: `owner_email=eq.${encodeURIComponent(normalizedEmail)}&select=*` });
    return mapAgency(rows?.[0]);
  }

  export async function getAgencyJobByPaypalOrder(orderId, agencyId) {
    if (!isPersistentStoreConfigured) return null;
    const rows = await requestTable('jobs', { query: `paypal_order_id=eq.${encodeURIComponent(orderId)}&agency_id=eq.${encodeURIComponent(agencyId)}&select=id` });
    return rows?.[0] || null;
  }

  export async function hasAgencyPayoutBatch(batchId, agencyId) {
    if (!isPersistentStoreConfigured) return false;
    const rows = await requestTable('jobs', { query: `paypal_payout_batch_id=eq.${encodeURIComponent(batchId)}&agency_id=eq.${encodeURIComponent(agencyId)}&select=id&limit=1` });
    return Boolean(rows?.length);
  }

  export async function claimLegacyAgency(userId, email) {
    if (!isPersistentStoreConfigured) throw new Error('Persistent Supabase storage must be configured before agency access is enabled.');
    const rows = await requestTable('agencies', {
      method: 'PATCH',
      query: 'id=eq.tundestudio&owner_user_id=is.null&owner_email=is.null&select=*',
      body: { owner_user_id: userId, owner_email: String(email).trim().toLowerCase() }
    });
    if (rows?.[0]) return mapAgency(rows[0]);
    return getAgencyForUser(userId, email);
  }

  export async function createAgencyForOwner({ id, name, slug, ownerUserId, ownerEmail }) {
    if (!isPersistentStoreConfigured) throw new Error('Persistent Supabase storage must be configured before an agency can be created.');
    try {
      const rows = await requestTable('agencies', {
        method: 'POST',
        body: { id, name, slug, owner_user_id: ownerUserId, owner_email: String(ownerEmail).trim().toLowerCase() }
      });
      if (!rows?.[0]) throw new Error('Supabase did not return the new agency.');
      await requestTable('marketplace_agency_profiles', {
        method: 'POST',
        body: { agency_id: id, tagline: 'Work we are proud to put our name on', story: `Welcome to ${name}. Tell customers about your team, your process, and what makes your work yours.` }
      });
      return mapAgency(rows[0]);
    } catch (e) {
      throw new Error(`Could not create agency in Supabase: ${e.message}`);
    }
  }

  export async function getMarketplaceAgencies() {
    if (!isPersistentStoreConfigured) return [{ id: 'tundestudio', name: "Tunde's Tailoring Studio", slug: 'tunde-studio' }];
    const rows = await requestTable('agencies', { query: 'select=id,name,slug&order=name.asc' });
    return (rows || []).map(mapAgency);
  }
    export async function addMarketplaceService({ id, agencyId, agencyName, category, title, description, priceCents, turnaround, initials }) {
      if (!isPersistentStoreConfigured) throw new Error('Persistent Supabase storage must be configured before services can be published.');
      try {
        const rows = await requestTable('marketplace_services', {
          method: 'POST',
          body: {
            id, agency_id: agencyId, agency_name: agencyName, category, title,
            description, price_cents: priceCents, turnaround, initials, active: true
          }
        });
        if (rows?.[0]) return mapMarketplaceService(rows[0]);
        throw new Error('Supabase did not return the published service.');
      } catch (e) {
        throw new Error(`Could not publish marketplace service in Supabase: ${e.message}`);
      }
    }

    function mapAgencyProfile(row, agencyName) {
      return {
        agencyId: row?.agency_id || 'tundestudio',
        agencyName,
        tagline: row?.tagline || 'Thoughtful work, made with care',
        story: row?.story || 'We work closely with each customer, from the first conversation through the final handoff.'
      };
    }

    export async function getMarketplaceAgencyProfile(agencyId, agencyName) {
      if (!isPersistentStoreConfigured) return mapAgencyProfile(null, agencyName);
      try {
        const [profiles, agencies] = await Promise.all([
          requestTable('marketplace_agency_profiles', { query: `agency_id=eq.${encodeURIComponent(agencyId)}&select=*` }),
          getAgencyById(agencyId)
        ]);
        return mapAgencyProfile(profiles?.[0], agencies?.name || agencyName);
      } catch (e) {
        throw new Error(`Could not load agency profile from Supabase: ${e.message}`);
      }
    }

    export async function updateMarketplaceAgencyProfile(agencyId, { tagline, story }, agencyName) {
      if (!isPersistentStoreConfigured) throw new Error('Persistent Supabase storage must be configured before the agency profile can be updated.');
      try {
        const rows = await requestTable('marketplace_agency_profiles', {
          method: 'POST',
          query: 'on_conflict=agency_id',
          prefer: 'resolution=merge-duplicates,return=representation',
          body: { agency_id: agencyId, tagline, story }
        });
        if (rows?.[0]) return mapAgencyProfile(rows[0], agencyName);
        throw new Error('Supabase did not return the updated agency profile.');
      } catch (e) {
        throw new Error(`Could not save agency profile in Supabase: ${e.message}`);
      }
    }

    function publicPortfolioUrl(path) {
      return `${supabaseUrl}/storage/v1/object/public/agency-portfolio/${path.split('/').map(encodeURIComponent).join('/')}`;
    }

    function mapMarketplacePortfolio(row) {
      return {
        id: row.id,
        agencyId: row.agency_id,
        title: row.title,
        category: row.category,
        description: row.description,
        imageUrl: publicPortfolioUrl(row.image_path),
        createdAt: row.created_at
      };
    }

    export async function getMarketplacePortfolio(agencyId) {
      if (!isPersistentStoreConfigured) return [];
      try {
        const rows = await requestTable('marketplace_portfolio', {
          query: `agency_id=eq.${encodeURIComponent(agencyId)}&active=eq.true&select=*&order=created_at.desc`
        });
        return (rows || []).map(mapMarketplacePortfolio);
      } catch (e) {
        throw new Error(`Could not load agency portfolio from Supabase: ${e.message}`);
      }
    }

    export async function uploadMarketplacePortfolioImage({ agencyId, imageBuffer, mimeType, extension }) {
      if (!isPersistentStoreConfigured) throw new Error('Persistent Supabase storage must be configured before portfolio images can be uploaded.');
      const imagePath = `${agencyId}/${crypto.randomUUID()}.${extension}`;
      const response = await fetch(`${supabaseUrl}/storage/v1/object/agency-portfolio/${imagePath.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': mimeType,
          'x-upsert': 'false',
          'cache-control': 'public, max-age=31536000'
        },
        body: imageBuffer
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Could not upload portfolio image (${response.status}): ${detail || response.statusText}`);
      }
      return imagePath;
    }

    export async function addMarketplacePortfolioItem({ agencyId, title, category, description, imagePath }) {
      try {
        const rows = await requestTable('marketplace_portfolio', {
          method: 'POST',
          body: { agency_id: agencyId, title, category, description, image_path: imagePath, active: true }
        });
        if (rows?.[0]) return mapMarketplacePortfolio(rows[0]);
        throw new Error('Supabase did not return the portfolio item.');
      } catch (e) {
        throw new Error(`Could not save portfolio item in Supabase: ${e.message}`);
      }
    }

    export async function deleteMarketplacePortfolioItem(itemId, agencyId) {
      try {
        const rows = await requestTable('marketplace_portfolio', {
          method: 'DELETE',
          query: `id=eq.${encodeURIComponent(itemId)}&agency_id=eq.${encodeURIComponent(agencyId)}&select=*`
        });
        return rows?.[0] ? { ...mapMarketplacePortfolio(rows[0]), imagePath: rows[0].image_path } : null;
      } catch (e) {
        throw new Error(`Could not remove portfolio item from Supabase: ${e.message}`);
      }
    }

    export async function deleteMarketplacePortfolioImage(imagePath) {
      const response = await fetch(`${supabaseUrl}/storage/v1/object/agency-portfolio`, {
        method: 'DELETE',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefixes: [imagePath] })
      });
      if (!response.ok) throw new Error(`Could not remove portfolio image (${response.status}): ${await response.text()}`);
    }
