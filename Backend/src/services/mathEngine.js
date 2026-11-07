
/**
 * Calculates the exact fair pay allocation for each crew member.
 * @param {Object} params
 * @param {number} params.totalCustomerPaymentCents
 * @param {number} params.materialCostsCents 
 * @param {number} params.bossShareCents 
 * @param {Array} params.crewMembers
 * @returns {Object} 
 */
export function calculateFairPay({
  totalCustomerPaymentCents,
  materialCostsCents = 0,
  bossShareCents = 0,
  crewMembers = []
}) {
  const cents = [totalCustomerPaymentCents, materialCostsCents, bossShareCents];
  if (cents.some(value => !Number.isSafeInteger(value) || value < 0 || value > 2147483647)) {
    throw new Error('Payment, costs, and boss share must be whole cents within the supported storage range.');
  }
  if (!Array.isArray(crewMembers) || crewMembers.length > 50) {
    throw new Error('Crew must be an array with no more than 50 members.');
  }
  for (const member of crewMembers) {
    const hours = Number(member?.hours);
    const weight = Number(member?.jobWeight ?? 1);
    if (!Number.isFinite(hours) || hours < 0 || hours > 1000 || !Number.isFinite(weight) || weight < 1 || weight > 2.5) {
      throw new Error(`Invalid hours or skill weight${member?.name ? ` for ${member.name}` : ''}.`);
    }
  }

  const totalReceived = totalCustomerPaymentCents;
  const costs = materialCostsCents;
  const bossShare = bossShareCents;

  const grossEarnings = totalReceived - costs;
  if (grossEarnings < 0) {
    throw new Error('Material costs cannot exceed total customer payment');
  }

  if (bossShare > grossEarnings) {
    throw new Error("Boss's share cannot exceed the money left after costs");
  }

  // The Crew Pile: remaining money to split among the crew
  const crewPileCents = grossEarnings - bossShare;

  if (crewMembers.length === 0) {
    return {
      totalCustomerPaymentCents: totalReceived,
      materialCostsCents: costs,
      bossShareCents: bossShare,
      crewPileCents: 0,
      totalPoints: 0,
      allocations: [],
      isBalanced: true,
      pennyDiscrepancyCents: 0
    };
  }

  // Handle special case: crew pile is 0
  if (crewPileCents === 0) {
    return {
      totalCustomerPaymentCents: totalReceived,
      materialCostsCents: costs,
      bossShareCents: bossShare,
      crewPileCents: 0,
      totalPoints: 0,
      allocations: crewMembers.map(m => ({
        ...m,
        points: (Number(m.hours) || 0) * (Number(m.jobWeight) || 1.0),
        amountCents: 0,
        amountDollars: '0.00',
        sharePercentage: '0.00%'
      })),
      isBalanced: true,
      pennyDiscrepancyCents: 0
    };
  }

  // Step 1: Calculate points = hours × jobWeight for each crew member
  const membersWithPoints = crewMembers.map((member, index) => {
    const hours = Math.max(0, Number(member.hours) || 0);
    const weight = Math.max(0.1, Number(member.jobWeight) || 1.0);
    const points = Number((hours * weight).toFixed(4));
    return {
      ...member,
      index,
      hours,
      jobWeight: weight,
      points
    };
  });

  const totalPoints = membersWithPoints.reduce((sum, m) => sum + m.points, 0);

  if (totalPoints <= 0) {
    throw new Error('Total crew points must be greater than zero to allocate the crew pile');
  }

  // Step 2 & 3: Pizza Slices - determine raw cents and track fractional remainder
  let allocatedCentsSum = 0;

  const rawAllocations = membersWithPoints.map(m => {
    const rawShareCents = (m.points / totalPoints) * crewPileCents;
    const floorCents = Math.floor(rawShareCents);
    const fraction = rawShareCents - floorCents;

    allocatedCentsSum += floorCents;

    return {
      ...m,
      amountCents: floorCents,
      fraction
    };
  });

  // Step 4: The Pennies Rule (Section 5)
  // Whole-cent precision: distribute leftover cents to members with largest fractional shares / points
  let remainderCents = crewPileCents - allocatedCentsSum;

  // Sort by fraction descending (break ties by highest points)
  const sortedByRemainderPriority = [...rawAllocations].sort((a, b) => {
    if (b.fraction !== a.fraction) return b.fraction - a.fraction;
    return b.points - a.points;
  });

  for (let i = 0; i < remainderCents; i++) {
    const luckyRecipient = sortedByRemainderPriority[i % sortedByRemainderPriority.length];
    luckyRecipient.amountCents += 1;
  }

  // Restore original order and format output
  const finalAllocations = rawAllocations.map(m => {
    const matched = sortedByRemainderPriority.find(s => s.index === m.index);
    const amountCents = matched.amountCents;
    const amountDollars = (amountCents / 100).toFixed(2);
    const sharePercentage = ((amountCents / crewPileCents) * 100).toFixed(2) + '%';

    // Helper reason generator (Section 5 & 6)
    const reason = generateAllocationReason(m, amountCents, crewPileCents);

    return {
      id: m.id,
      personId: m.personId || null,
      name: m.name,
      role: m.role || m.job,
      email: m.email,
      hours: m.hours,
      jobWeight: m.jobWeight,
      points: m.points,
      amountCents,
      amountDollars,
      sharePercentage,
      reason,
      thankYouNote: m.thankYouNoteDraft || m.thankYouNote || `Thank you ${m.name} for your great work!`
    };
  });

  // Verification Guardrail: Verify sum(allocations) === crewPileCents exactly
  const finalSumCents = finalAllocations.reduce((sum, a) => sum + a.amountCents, 0);
  const isBalanced = finalSumCents === crewPileCents;
  const pennyDiscrepancyCents = crewPileCents - finalSumCents;

  return {
    totalCustomerPaymentCents: totalReceived,
    materialCostsCents: costs,
    bossShareCents: bossShare,
    crewPileCents,
    totalPoints: Number(totalPoints.toFixed(2)),
    allocations: finalAllocations,
    finalSumCents,
    isBalanced,
    pennyDiscrepancyCents
  };
}

/**
 * Generates an intuitive plain-language reason for the split
 */
function generateAllocationReason(member, amountCents, crewPileCents) {
  const percent = Math.round((amountCents / crewPileCents) * 100);
  return `${member.hours}h × ${member.jobWeight}x skill weight (${member.points} pts) &bull; ${percent}% of crew pile`;
}

/**
 * Strict Code Guardrails Validation (Section 16)
 * Blocks payouts if any safety constraint is violated.
 */
export function validatePaymentGuardrails({
  totalCustomerPaymentCents,
  materialCostsCents,
  bossShareCents,
  allocations = []
}) {
  const errors = [];
  const warnings = [];

  if (![totalCustomerPaymentCents, materialCostsCents, bossShareCents].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 2147483647)) {
    return { isValid: false, errors: ['Payment, costs, and boss share must be whole cents within the supported storage range.'] };
  }
  if (!Array.isArray(allocations)) {
    return { isValid: false, errors: ['Allocations must be an array.'] };
  }

  const expectedCrewPile = totalCustomerPaymentCents - materialCostsCents - bossShareCents;
  const actualAllocated = allocations.reduce((sum, a) => sum + (Number.isSafeInteger(a?.amountCents) ? a.amountCents : 0), 0);
  if (allocations.some(a => !Number.isSafeInteger(a?.amountCents))) {
    errors.push('Every payout amount must be a whole number of cents.');
  }

  for (const allocation of allocations) {
    const hours = Number(allocation?.hours);
    if (Number.isFinite(hours) && hours > 100) {
      warnings.push(`${allocation.name || 'A crew member'} has unusually high hours (${hours}). Review the work story.`);
    }
    if (expectedCrewPile > 0 && Number.isSafeInteger(allocation?.amountCents) && allocation.amountCents / expectedCrewPile >= 0.8) {
      warnings.push(`${allocation.name || 'A crew member'} receives more than 80% of the crew pile. Review the split.`);
    }
  }

  // Guardrail 1: Exact penny match
  if (actualAllocated !== expectedCrewPile) {
    errors.push(`Penny mismatch: Crew pile is ${expectedCrewPile} cents ($${(expectedCrewPile / 100).toFixed(2)}), but allocations total ${actualAllocated} cents ($${(actualAllocated / 100).toFixed(2)}). Send is blocked.`);
  }

  // Guardrail 2: Budget constraint
  if (expectedCrewPile + materialCostsCents + bossShareCents !== totalCustomerPaymentCents) {
    errors.push('Budget violation: (Crew Pile + Costs + Boss Share) does not equal Customer Payment.');
  }

  // Guardrail 3: Minimum payment rule (every payment must be at least 1 cent)
  const zeroOrNegative = allocations.filter(a => a.amountCents < 1);
  if (zeroOrNegative.length > 0) {
    errors.push(`Zero or negative payout detected for: ${zeroOrNegative.map(a => a.name).join(', ')}. Every payment must be at least 1 cent.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

