'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/supabase';
import { ProtectedPage } from '@/components/AuthProvider';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  User,
  Clock,
  Award,
  Send,
  RefreshCw,
  Edit3,
  Check,
  Pizza,
  Lock,
  ExternalLink,
  ChevronRight,
  MessageSquareHeart,
  CreditCard,
  Layers,
  Zap,
  Users,
  Mic,
  MicOff
} from 'lucide-react';

interface BrowserSpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<BrowserSpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface CrewMemberItem {
  id: string;
  personId?: string;
  name: string;
  job: string;
  hours: number;
  jobWeight: number;
  email: string;
  summary?: string;
  thankYouNoteDraft: string;
  amountCents?: number;
  amountDollars?: string;
  sharePercentage?: string;
  points?: number;
  learnedWeightSamples?: number;
  learnedAverageSharePercent?: number;
}

interface CrewHabit {
  key: string;
  role: string;
  jobCount: number;
  averageWeight: number;
  averageSharePercent: number;
}

interface DynamicPreset {
  id: string;
  title: string;
  domain: string;
  story: string;
  payment: number;
  costs: number;
  bossShare: number;
}

function normalizeHabitKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function SplitWizardContent() {
  const wizardTopRef = useRef<HTMLDivElement>(null);

  // App Wizard Step: 1 (Money) -> 2 (Story) -> 3 (Slices & Sliders) -> 4 (Send & Receipt)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Dynamic presets and crew from backend
  const [presets, setPresets] = useState<DynamicPreset[]>([]);
  const [savedCrew, setSavedCrew] = useState<any[]>([]);
  const [learnedHabits, setLearnedHabits] = useState<CrewHabit[]>([]);
  const [completedLearningJobs, setCompletedLearningJobs] = useState<number>(0);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Step 1: Finances
  const [customerPayment, setCustomerPayment] = useState<number>(200);
  const [materialCosts, setMaterialCosts] = useState<number>(40);
  const [bossShare, setBossShare] = useState<number>(90);
  const [isCreatingOrder, setIsCreatingOrder] = useState<boolean>(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [marketplaceBooking, setMarketplaceBooking] = useState<{ title: string; customerName: string; customerEmail: string; customerNotes: string } | null>(null);
  const [bookingLoadError, setBookingLoadError] = useState<string | null>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [customerPaymentCaptured, setCustomerPaymentCaptured] = useState<boolean>(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Step 2: Story Box
  const [storyText, setStoryText] = useState<string>(
    "Tola sewed for 8 hours. Bisi did the finishing for 5 hours. Kunle did the delivery, about 2 hours."
  );
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [missingInfoAlert, setMissingInfoAlert] = useState<{ isMissing: boolean; question: string } | null>(null);
  const [clarificationInput, setClarificationInput] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechBaseTextRef = useRef<string>('');

  // Step 3: Crew & Allocations
  const [crewList, setCrewList] = useState<CrewMemberItem[]>([
    {
      id: '1',
      name: 'Tola',
      job: 'Sewing',
      hours: 8,
      jobWeight: 1.5,
      email: '',
      thankYouNoteDraft: 'Thank you Tola for your hard work sewing all day!'
    },
    {
      id: '2',
      name: 'Bisi',
      job: 'Finishing',
      hours: 5,
      jobWeight: 2.0,
      email: '',
      thankYouNoteDraft: 'Thank you Bisi for the meticulous finishing work!'
    },
    {
      id: '3',
      name: 'Kunle',
      job: 'Delivery',
      hours: 2,
      jobWeight: 1.0,
      email: '',
      thankYouNoteDraft: 'Thank you Kunle for getting the packages safely to the clients!'
    }
  ]);

  // Step 4: Payout Execution & Polling
  const [isSendingPayout, setIsSendingPayout] = useState<boolean>(false);
  const [payoutResult, setPayoutResult] = useState<any | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<string>('PENDING');
  const [itemStatuses, setItemStatuses] = useState<Record<string, string>>({});
  const [isPollingReceipt, setIsPollingReceipt] = useState<boolean>(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const refreshLearnedHabits = async () => {
    try {
      const response = await apiFetch(`${API_URL}/api/learning/habits`);
      const result = await response.json();
      if (response.ok && result?.success && result.data) {
        setLearnedHabits(Array.isArray(result.data.habits) ? result.data.habits : []);
        setCompletedLearningJobs(Number(result.data.completedJobs) || 0);
      }
    } catch {
      // Habit suggestions are optional; the usual math suggestion remains available.
    }
  };

  const stopVoiceInput = () => {
    speechRecognitionRef.current?.stop();
    setIsListening(false);
  };

  const abortVoiceInput = () => {
    speechRecognitionRef.current?.abort();
    speechRecognitionRef.current = null;
    setIsListening(false);
  };

  const startVoiceInput = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Voice typing is not supported in this browser. Try a recent version of Chrome or Edge, or type your story below.');
      return;
    }

    setSpeechError(null);
    speechBaseTextRef.current = storyText.trim() ? `${storyText.trim()} ` : '';
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    speechRecognitionRef.current = recognition;

    recognition.onresult = event => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) finalTranscript += `${result[0].transcript} `;
        else interimTranscript += result[0].transcript;
      }
      setStoryText(`${speechBaseTextRef.current}${finalTranscript}${interimTranscript}`.trim());
    };

    recognition.onerror = event => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setSpeechError('Microphone access was blocked. Allow microphone access in your browser, then try again.');
      } else if (event.error === 'no-speech') {
        setSpeechError('No speech was detected. Try speaking again or type your story.');
      } else if (event.error !== 'aborted') {
        setSpeechError('Voice transcription stopped unexpectedly. Your story is still editable below.');
      }
    };

    recognition.onend = () => {
      speechRecognitionRef.current = null;
      setIsListening(false);
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      speechRecognitionRef.current = null;
      setIsListening(false);
      setSpeechError('Could not start voice typing. Check microphone access and try again.');
    }
  };

  useEffect(() => () => speechRecognitionRef.current?.abort(), []);

  // Fetch dynamic presets and saved crew on mount
  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch(`${API_URL}/api/presets`).then(r => r.json()).catch(() => ({ success: false })),
      apiFetch(`${API_URL}/api/people`).then(r => r.json()).catch(() => ({ success: false })),
      apiFetch(`${API_URL}/api/learning/habits`).then(r => r.json()).catch(() => ({ success: false }))
    ]).then(([presetsData, crewData, habitData]) => {
      if (!active) return;
      if (presetsData?.success && Array.isArray(presetsData.data)) {
        setPresets(presetsData.data);
      }
      if (crewData?.success && Array.isArray(crewData.data)) {
        setSavedCrew(crewData.data);
        setCrewList(current => current.map(member => {
          const saved = crewData.data.find((person: any) => person.name?.toLowerCase() === member.name.toLowerCase());
          return saved ? { ...member, personId: saved.id, email: saved.email } : member;
        }));
      }
      if (habitData?.success && habitData.data) {
        setLearnedHabits(Array.isArray(habitData.data.habits) ? habitData.data.habits : []);
        setCompletedLearningJobs(Number(habitData.data.completedJobs) || 0);
      }
      setLoadingData(false);
    });
    return () => { active = false; };
  }, [API_URL]);

  // A confirmed marketplace booking reuses its captured payment; it must never
  // create a second customer charge when the agency prepares the team split.
  useEffect(() => {
    const requestedJobId = new URLSearchParams(window.location.search).get('jobId');
    if (!requestedJobId) return;
    let active = true;
    apiFetch(`${API_URL}/api/jobs/${encodeURIComponent(requestedJobId)}`)
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Could not load this agency job.');
        const job = result.data;
        if (!job.serviceId || !job.paymentCaptured) throw new Error('This marketplace booking has not been paid yet.');
        if (!active) return;
        setJobId(job.id);
        setPaypalOrderId(job.paypalOrderId || null);
        setCustomerPayment(Number(job.totalCustomerPaymentCents) / 100);
        setMaterialCosts(Number(job.materialCostsCents || 0) / 100);
        setBossShare(Number(job.bossShareCents || 0) / 100);
        setCustomerPaymentCaptured(true);
        setStoryText('');
        setCrewList([]);
        setMarketplaceBooking({
          title: job.title,
          customerName: job.customerName || '',
          customerEmail: job.customerEmail || '',
          customerNotes: job.customerNotes || ''
        });
        setCurrentStep(2);
      })
      .catch(error => { if (active) setBookingLoadError(error.message || 'Could not load this agency job.'); });
    return () => { active = false; };
  }, [API_URL]);

  // Announce step change for screen readers
  useEffect(() => {
    wizardTopRef.current?.focus();
  }, [currentStep]);

  // Derived Financials
  const grossEarnings = Math.max(0, customerPayment - materialCosts);
  const maxBossShare = grossEarnings;
  const crewPileDollars = Math.max(0, grossEarnings - bossShare);

  // Automatically adjust boss share if gross pool shrinks below boss share
  useEffect(() => {
    if (bossShare > maxBossShare) {
      setBossShare(maxBossShare);
    }
  }, [maxBossShare, bossShare]);

  // Deterministic whole-cent calculation with the Pennies Rule
  const calculatedAllocations = useMemo(() => {
    const crewPileCents = Math.round(crewPileDollars * 100);
    if (crewPileCents <= 0 || crewList.length === 0) {
      return crewList.map(item => ({
        ...item,
        amountCents: 0,
        amountDollars: '0.00',
        sharePercentage: '0.0%'
      }));
    }

    const itemsWithPoints = crewList.map(item => ({
      ...item,
      points: Number(Math.max(0, (item.hours || 0) * (item.jobWeight || 1.0)).toFixed(4))
    }));

    const totalPoints = itemsWithPoints.reduce((sum, item) => sum + item.points, 0);

    if (totalPoints <= 0) {
      return itemsWithPoints.map(item => ({
        ...item,
        amountCents: 0,
        amountDollars: '0.00',
        sharePercentage: '0.0%'
      }));
    }

    const unrounded = itemsWithPoints.map(item => {
      const rawCents = (item.points / totalPoints) * crewPileCents;
      const baseCents = Math.floor(rawCents);
      const remainder = rawCents - baseCents;
      return { item, baseCents, remainder };
    });

    const allocatedBase = unrounded.reduce((sum, u) => sum + u.baseCents, 0);
    let penniesToDistribute = crewPileCents - allocatedBase;

    unrounded.sort((a, b) => b.remainder - a.remainder || b.item.points - a.item.points);
    for (let i = 0; i < penniesToDistribute; i++) {
      unrounded[i % unrounded.length].baseCents += 1;
    }

    return unrounded.map(({ item, baseCents }) => {
      const sharePercentage = ((baseCents / crewPileCents) * 100).toFixed(1) + '%';
      return {
        ...item,
        amountCents: baseCents,
        amountDollars: (baseCents / 100).toFixed(2),
        sharePercentage,
        points: item.points
      };
    });
  }, [crewList, crewPileDollars]);

  const totalAllocatedCents = calculatedAllocations.reduce((sum, item) => sum + (item.amountCents || 0), 0);
  const expectedCrewPileCents = Math.round(crewPileDollars * 100);
  const isExactPennyMatch = totalAllocatedCents === expectedCrewPileCents;

  // Step 1: Create a Sandbox order and open its customer approval page.
  const handleCreateCustomerOrder = async () => {
    void refreshLearnedHabits();
    const approvalWindow = window.open('', '_blank');
    setCheckoutError(null);
    setIsCreatingOrder(true);
    try {
      const res = await apiFetch(`${API_URL}/api/paypal/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: customerPayment,
          materialCosts,
          bossShare,
          currency: 'USD',
          description: 'BudPay Fair Pay Job'
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data.orderId || !data.jobId || !data.approvalUrl) {
        throw new Error(data?.error || 'PayPal did not return an approval link for this order.');
      }
      setPaypalOrderId(data.orderId);
      setJobId(data.jobId);
      setApprovalUrl(data.approvalUrl);
      setCustomerPaymentCaptured(false);
      if (approvalWindow) {
        approvalWindow.opener = null;
        approvalWindow.location.href = data.approvalUrl;
      }
    } catch (e: any) {
      approvalWindow?.close();
      setCheckoutError(e.message || 'Could not create the PayPal Sandbox order.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleConfirmCustomerPayment = async () => {
    if (!paypalOrderId || !jobId) return;
    setIsConfirmingPayment(true);
    setCheckoutError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/paypal/capture-order/${encodeURIComponent(paypalOrderId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });
      const data = await res.json();
      if (!res.ok || !data?.success || data.status !== 'COMPLETED') {
        throw new Error(data?.error || 'PayPal has not confirmed the customer payment yet.');
      }
      setCustomerPaymentCaptured(true);
      setCurrentStep(2);
    } catch (e: any) {
      setCheckoutError(e.message || 'Could not confirm customer payment.');
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  // Step 2: AI Story Parsing
  const handleParseStory = async () => {
    setIsAiLoading(true);
    setAiError(null);
    setFallbackNotice(null);
    setMissingInfoAlert(null);

    try {
      const res = await apiFetch(`${API_URL}/api/ai/parse-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story: storyText })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to parse story');
      }

      if (json.data.fallbackNotice) {
        setFallbackNotice(json.data.fallbackNotice);
      }

      const { isMissingInfo, clarificationQuestion, crewMembers } = json.data;

      if (isMissingInfo && clarificationQuestion) {
        setMissingInfoAlert({ isMissing: true, question: clarificationQuestion });
      }

      if (Array.isArray(crewMembers) && crewMembers.length > 0) {
        setCrewList(
          crewMembers.map((m: any, idx: number) => {
            const matchedSaved = savedCrew.find(s => s.name?.toLowerCase() === m.name?.toLowerCase());
            const taskKey = normalizeHabitKey(String(m.job || ''));
            const matchedHabit = learnedHabits
              .filter(habit => taskKey && (taskKey === habit.key || taskKey.includes(habit.key) || habit.key.includes(taskKey)))
              .sort((a, b) => b.key.length - a.key.length)[0];
            return {
              id: `crew_${Date.now()}_${idx}`,
              personId: matchedSaved?.id,
              name: m.name,
              job: m.job,
              hours: m.hours || 0,
              jobWeight: matchedHabit?.averageWeight ?? m.suggestedJobWeight ?? 1.5,
              learnedWeightSamples: matchedHabit?.jobCount,
              learnedAverageSharePercent: matchedHabit?.averageSharePercent,
              email: matchedSaved?.email || '',
              summary: m.summary,
              thankYouNoteDraft: m.thankYouNoteDraft || `Thank you ${m.name} for your great work!`
            };
          })
        );
      }

      if (!isMissingInfo) {
        setCurrentStep(3);
      }
    } catch (err: any) {
      setAiError(err.message || 'Error communicating with AI parser');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAnswerClarification = () => {
    if (!clarificationInput.trim()) return;
    const updatedStory = `${storyText}. ${clarificationInput.trim()}`;
    setStoryText(updatedStory);
    setClarificationInput('');
    setMissingInfoAlert(null);
  };

  // Step 4: Approve & Send Payout
  const handleSendPayout = async () => {
    if (!jobId || !customerPaymentCaptured) {
      setPayoutError('Confirm the customer payment before sending a crew payout.');
      return;
    }
    setIsSendingPayout(true);
    setPayoutError(null);

    try {
      const res = await apiFetch(`${API_URL}/api/pay/approve-and-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          bossShareCents: Math.round(bossShare * 100),
          story: storyText,
          allocations: calculatedAllocations,
          emailSubject: "You've received your fair pay from BudPay!",
          emailMessage: "Thank you for being part of our hardworking crew!"
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit batch payout');
      }

      setPayoutResult(data);
      setBatchStatus(data.batchStatus || 'PENDING');
      setCurrentStep(4);
      pollReceiptStatus(data.batchId);
    } catch (err: any) {
      setPayoutError(err.message || 'Payout submission failed');
    } finally {
      setIsSendingPayout(false);
    }
  };

  const pollReceiptStatus = (batchId: string) => {
    let attempts = 0;
    const maxAttempts = 15;
    setIsPollingReceipt(true);
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await apiFetch(`${API_URL}/api/paypal/payout/${batchId}`);
        const data = await res.json();
        if (data && data.success && data.batch) {
          const status = data.batch.batch_header?.batch_status;
          setBatchStatus(status);
          if (Array.isArray(data.batch.items)) {
            const statusMap: Record<string, string> = {};
            data.batch.items.forEach((item: any) => {
              const email = item.payout_item?.receiver;
              if (email) statusMap[email] = item.transaction_status;
            });
            setItemStatuses(statusMap);
          }
          if (status === 'SUCCESS' || status === 'DENIED' || status === 'CANCELED' || attempts >= maxAttempts) {
            clearInterval(interval);
            setIsPollingReceipt(false);
          }
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setIsPollingReceipt(false);
        }
      } catch (e) {
        console.error('Polling error:', e);
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setIsPollingReceipt(false);
        }
      }
    }, 2500);
  };

  const handleUpdateCrewField = (id: string, field: keyof CrewMemberItem, value: any) => {
    setCrewList(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleUpdateCrewEmail = (memberId: string, email: string) => {
    setCrewList(prev => prev.map(member => member.id === memberId
      ? { ...member, email, personId: undefined }
      : member));
  };

  const paymentWarnings = calculatedAllocations.flatMap(member => {
    const warnings: string[] = [];
    if (member.hours > 100) warnings.push(`${member.name} has over 100 hours; review the work story.`);
    if (expectedCrewPileCents > 0 && (member.amountCents || 0) / expectedCrewPileCents >= 0.8) {
      warnings.push(`${member.name} receives more than 80% of the crew pile; review the split.`);
    }
    return warnings;
  });
  const hasInvalidCrew = calculatedAllocations.some(member =>
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email) || member.hours <= 0 || (member.amountCents || 0) < 1
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-8" ref={wizardTopRef} tabIndex={-1}>
      {/* Screen reader live announcement */}
      <div className="sr-only" aria-live="polite">
        Current step is step {currentStep} of 4.
      </div>

      {bookingLoadError && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{bookingLoadError} <Link href="/history" className="underline">Return to agency jobs</Link>.</div>}
      {marketplaceBooking && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        <p className="font-bold">Paid marketplace booking: {marketplaceBooking.title}</p>
        <p className="mt-1 text-xs">Customer: {marketplaceBooking.customerName} · {marketplaceBooking.customerEmail}</p>
        {marketplaceBooking.customerNotes && <p className="mt-2 border-t border-blue-200 pt-2 text-xs leading-5">Customer request: {marketplaceBooking.customerNotes}</p>}
      </div>}

      {/* Stepper Navigation */}
      <nav aria-label="Wizard Steps Progress" className="w-full">
        <ol className="grid grid-cols-4 gap-2 sm:gap-4 text-xs font-bold">
          {[
            { num: 1, title: 'Money & Costs' },
            { num: 2, title: 'The Story' },
            { num: 3, title: 'Slices & Sliders' },
            { num: 4, title: 'Send & Receipt' }
          ].map(s => {
            const isCurrent = currentStep === s.num;
            const isPast = currentStep > s.num;
            return (
              <li
                key={s.num}
                className={`p-3 rounded-2xl border transition flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left ${isCurrent
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : isPast
                    ? 'bg-blue-50 text-blue-900 border-blue-200 cursor-pointer hover:bg-blue-100'
                    : 'bg-white text-slate-400 border-slate-200'
                  }`}
                onClick={() => {
                  if (isPast) setCurrentStep(s.num as any);
                }}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isCurrent
                    ? 'bg-white text-blue-700'
                    : isPast
                      ? 'bg-blue-200 text-blue-800'
                      : 'bg-slate-100 text-slate-500'
                    }`}
                >
                  {isPast ? '✓' : s.num}
                </span>
                <span className="hidden sm:inline font-semibold tracking-tight">{s.title}</span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* STEP 1: MONEY & COSTS*/}

      {currentStep === 1 && (
        <section aria-labelledby="step1-heading" className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
              Step 1 of 4
            </span>
            <h1 id="step1-heading" className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Money Up Front & Upfront Costs
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Start with the total payment from the customer. Any upfront supplies are taken off first.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Customer Payment */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
              <label htmlFor="customer-payment-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Customer Payment Amount (USD) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold" aria-hidden="true">
                  $
                </span>
                <input
                  id="customer-payment-input"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={customerPayment}
                  disabled={Boolean(jobId)}
                  onChange={e => setCustomerPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                  aria-describedby="payment-hint"
                  className="w-full pl-8 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-xl font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500"
                />
              </div>
              <p id="payment-hint" className="text-xs text-slate-500">
                Total money received from the customer for the job.
              </p>

              {/* Optional sandbox order simulator */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleCreateCustomerOrder}
                  disabled={isCreatingOrder || Boolean(jobId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                  {isCreatingOrder ? 'Creating PayPal Order...' : paypalOrderId ? 'PayPal Order Created' : 'Create PayPal Sandbox Order'}
                </button>
                {paypalOrderId && (
                  <span className="text-[10px] font-mono text-emerald-700 font-bold">ID: {paypalOrderId.slice(0, 8)}...</span>
                )}
              </div>
              {approvalUrl && !customerPaymentCaptured && (
                <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs text-blue-900">Approve the order with a PayPal Sandbox buyer, then confirm it here.</p>
                  <a href={approvalUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700 underline">Open PayPal approval page</a>
                  <button type="button" onClick={handleConfirmCustomerPayment} disabled={isConfirmingPayment} className="block rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                    {isConfirmingPayment ? 'Checking PayPal...' : 'I approved it - confirm customer payment'}
                  </button>
                </div>
              )}
              {customerPaymentCaptured && <p role="status" className="pt-2 text-xs font-bold text-emerald-700">Customer payment confirmed by PayPal.</p>}
              {checkoutError && <p role="alert" className="pt-2 text-xs font-semibold text-rose-700">{checkoutError}</p>}
            </div>

            {/* Material Costs */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
              <label htmlFor="material-costs-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Upfront Material Expenses (USD)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold" aria-hidden="true">
                  $
                </span>
                <input
                  id="material-costs-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={materialCosts}
                  disabled={Boolean(jobId)}
                  onChange={e => setMaterialCosts(Math.max(0, parseFloat(e.target.value) || 0))}
                  aria-describedby="costs-hint"
                  className="w-full pl-8 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-xl font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500"
                />
              </div>
              <p id="costs-hint" className="text-xs text-slate-500">
                Fabric, threads, spices, fuel, or supplies (deducted before profit sharing).
              </p>
            </div>
          </div>

          {/* Gross Pool Banner */}
          <div
            role="region"
            aria-label="Remaining Gross Pool"
            className="p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Gross Pool to Split
              </span>
              <p className="text-sm text-slate-700 mt-0.5">
                Customer payment minus upfront supplies: <span className="font-mono">${customerPayment.toFixed(2)} - ${materialCosts.toFixed(2)}</span>
              </p>
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-blue-700" aria-live="polite">
              ${grossEarnings.toFixed(2)}
            </div>
          </div>

          {/* Validation Alert */}
          {customerPayment <= 0 && (
            <div role="alert" className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              Please enter a customer payment amount greater than $0.00 to continue.
            </div>
          )}
          {materialCosts > customerPayment && (
            <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
              Material expenses cannot exceed the total customer payment.
            </div>
          )}

          {/* STEP 1 TO STEP 2 BUTTON (UNBLOCKED & FULLY ACCESSIBLE) */}
          <div className="flex justify-end pt-4">
            <button
              type="button"
              id="continue-to-step-2-btn"
              onClick={() => setCurrentStep(2)}
              disabled={customerPayment <= 0 || materialCosts > customerPayment || !customerPaymentCaptured}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-base shadow-md transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
            >
              {customerPaymentCaptured ? 'Continue to Step 2: Tell the Story' : 'Confirm customer payment to continue'}
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 2: TELL THE STORY*/}

      {currentStep === 2 && (
        <section aria-labelledby="step2-heading" className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
                Step 2 of 4
              </span>
              <h1 id="step2-heading" className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                The Boss Tells The Story
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Describe what your crew did in plain, everyday words. Gemini extracts hours, roles, and generates thank-you notes.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
              Gemini AI Active
            </div>
          </div>

          {/* Dynamic Presets fetched from Backend API */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Story Templates (Dynamic from Backend)
            </span>
            <div className="flex flex-wrap gap-2">
              {presets.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (isListening) abortVoiceInput();
                    setSpeechError(null);
                    setStoryText(item.story);
                    setBossShare(item.bossShare);
                    setMissingInfoAlert(null);
                  }}
                  className="text-xs px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>

          {/* Story Textarea */}
          <div className="space-y-2">
            <label htmlFor="story-textarea" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Your Words / Job Story *
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={isListening ? stopVoiceInput : startVoiceInput}
                aria-pressed={isListening}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 ${isListening
                  ? 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 focus-visible:ring-blue-200'}`}
              >
                {isListening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                {isListening ? 'Stop listening' : 'Tell your story'}
              </button>
              <p className="text-xs text-slate-500" role="status" aria-live="polite">
                {isListening
                  ? 'Listening… your transcript is appearing below.'
                  : 'Voice typing adds to the story below. Review or edit it before continuing; your browser may process speech online.'}
              </p>
              {storyText.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    if (isListening) abortVoiceInput();
                    setStoryText('');
                    setSpeechError(null);
                  }}
                  className="text-xs font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                >
                  Clear story
                </button>
              )}
            </div>
            {speechError && (
              <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                {speechError}
              </p>
            )}
            <textarea
              id="story-textarea"
              rows={4}
              required
              value={storyText}
              onChange={e => setStoryText(e.target.value)}
              readOnly={isListening}
              placeholder="e.g. Tola sewed for 8 hours. Bisi did the finishing for 5 hours. Kunle did the delivery, about 2 hours."
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500 leading-relaxed font-sans font-medium read-only:bg-blue-50"
            />
          </div>

          {/* Clarification Alert */}
          {missingInfoAlert && (
            <div role="alert" className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-3">
              <div className="flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    BudPay Needs One Quick Clarification
                  </h2>
                  <p className="text-sm text-amber-900 mt-0.5 font-bold">{missingInfoAlert.question}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={clarificationInput}
                  onChange={e => setClarificationInput(e.target.value)}
                  placeholder="e.g. Tola worked 8 hours"
                  aria-label="Answer the clarification question"
                  className="flex-1 px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
                <button
                  type="button"
                  onClick={handleAnswerClarification}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  Answer Question
                </button>
              </div>
            </div>
          )}

          {aiError && (
            <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {fallbackNotice && (
            <div role="status" className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold block">BudPay Resilience Active</span>
                <span>{fallbackNotice}</span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                if (isListening) stopVoiceInput();
                setCurrentStep(1);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Step 1
            </button>

            <button
              type="button"
              disabled={isAiLoading || isListening || !storyText.trim()}
              onClick={handleParseStory}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
            >
              {isAiLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Gemini Reading Story...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Read Story & Calculate Slices
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: SLICES & SLIDERS*/}
      {currentStep === 3 && (
        <section aria-labelledby="step3-heading" className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
              Step 3 of 4
            </span>
            <h1 id="step3-heading" className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Slices & Sliders
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Adjust your share as the boss. The remaining money is the &ldquo;crew pile&rdquo; divided down to the exact penny.
            </p>
          </div>

          <aside aria-label="Learned crew split preferences" className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
            <p className="font-bold">Learning your usual split</p>
            <p className="mt-1 text-xs leading-relaxed text-indigo-900">
              {completedLearningJobs < 3
                ? `Complete ${3 - completedLearningJobs} more fully successful payout job${3 - completedLearningJobs === 1 ? '' : 's'} to start learning your preferences (${completedLearningJobs}/3 so far).`
                : learnedHabits.length > 0
                  ? `Using your past choices for ${learnedHabits.map(habit => habit.role).join(', ')}. Suggestions stay editable.`
                  : 'Three payout jobs are complete. The helper learns a work type after seeing it in three successful jobs.'}
              {' '}Only fully successful payout jobs count.
            </p>
          </aside>

          {/* Boss Slider Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Boss Share Slider</span>
                <h2 className="text-lg font-bold text-slate-900">Your Take-Home Profit</h2>
              </div>
              <div className="text-3xl font-extrabold text-blue-700" aria-live="polite">
                ${bossShare.toFixed(2)}
              </div>
            </div>

            <input
              type="range"
              min="0"
              max={maxBossShare}
              step="1"
              value={bossShare}
              onChange={e => setBossShare(parseFloat(e.target.value) || 0)}
              aria-label="Boss Take-Home Profit Slider"
              className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500"
            />

            <div className="flex justify-between text-xs text-slate-500 font-bold">
              <span>$0 (100% to crew)</span>
              <span className="font-mono text-emerald-800">Remaining for Crew: ${crewPileDollars.toFixed(2)}</span>
              <span>Max (${maxBossShare.toFixed(2)})</span>
            </div>
          </div>

          {/* Crew Cards */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center justify-between">
              <span>Crew Allocation Cards ({crewList.length})</span>
              <span className="text-xs text-slate-500 font-normal">Skill weights & hours extracted by Gemini</span>
            </h2>

            <div className="space-y-4">
              {calculatedAllocations.map(member => (
                <article
                  key={member.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-blue-300 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 font-extrabold flex items-center justify-center text-sm">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{member.name}</h3>
                        <p className="text-xs text-slate-500 font-medium">{member.job}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-extrabold text-emerald-700" aria-live="polite">
                        ${member.amountDollars}
                      </div>
                      <span className="text-xs text-slate-500 font-bold">{member.sharePercentage} of crew pile</span>
                    </div>
                  </div>

                  {/* Hours & Weight Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label htmlFor={`hours-${member.id}`} className="block font-bold text-slate-600 mb-1">
                        Hours Worked
                      </label>
                      <input
                        id={`hours-${member.id}`}
                        type="number"
                        min="0"
                        step="0.5"
                        value={member.hours}
                        onChange={e => handleUpdateCrewField(member.id, 'hours', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor={`weight-${member.id}`} className="block font-bold text-slate-600 mb-1">
                        Skill Weight (1.0 &ndash; 2.5)
                      </label>
                      <select
                        id={`weight-${member.id}`}
                        value={member.jobWeight}
                        onChange={e => handleUpdateCrewField(member.id, 'jobWeight', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={1.0}>1.0 &times; (Standard / Basic / Delivery)</option>
                        <option value={1.5}>1.5 &times; (Core Skilled / Sewing / Prep)</option>
                        <option value={2.0}>2.0 &times; (High Skill / Intricate Finishing)</option>
                        <option value={2.5}>2.5 &times; (Master Specialist)</option>
                      </select>
                      {member.learnedWeightSamples && (
                        <p className="mt-1 text-[10px] leading-relaxed text-indigo-700">
                          Past jobs assigned this work about {member.learnedAverageSharePercent}% of the crew pile; this starting weight reflects your usual choice across {member.learnedWeightSamples} successful jobs.
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor={`email-${member.id}`} className="block font-bold text-slate-600 mb-1">
                        PayPal Sandbox Email
                      </label>
                      <input
                        id={`email-${member.id}`}
                        type="email"
                        required
                        value={member.email}
                        onChange={e => handleUpdateCrewEmail(member.id, e.target.value)}
                        placeholder="verified-sandbox-account@example.com"
                        aria-describedby={`email-hint-${member.id}`}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p id={`email-hint-${member.id}`} className="mt-1 text-[10px] text-slate-500">Roster matches are prefilled; you can enter another verified Sandbox email.</p>
                    </div>
                  </div>

                  {/* Thank you note */}
                  <div>
                    <label htmlFor={`note-${member.id}`} className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                      <MessageSquareHeart className="w-3.5 h-3.5 text-blue-600" />
                      AI Thank-You Note (Sent with PayPal Payout)
                    </label>
                    <input
                      id={`note-${member.id}`}
                      type="text"
                      value={member.thankYouNoteDraft}
                      onChange={e => handleUpdateCrewField(member.id, 'thankYouNoteDraft', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>

          {paymentWarnings.length > 0 && (
            <div role="alert" className="space-y-1 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-semibold text-amber-900">
              <p className="font-bold">Review these unusual values before approving:</p>
              {paymentWarnings.map(warning => <p key={warning}>{warning}</p>)}
            </div>
          )}
          {hasInvalidCrew && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
              Each person needs an active saved roster entry, positive hours, and at least one cent. <Link href="/roster" className="underline">Manage the crew roster</Link>.
            </div>
          )}

          {/* Whole Cent Pennies Rule Reconciler */}
          <div
            role="status"
            aria-label="Penny reconciliation audit"
            className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Pennies Rule Reconciled
                </span>
                <p className="text-xs text-emerald-900">
                  Total allocated: <span className="font-mono font-bold">${(totalAllocatedCents / 100).toFixed(2)}</span> &bull; Zero float discrepancy
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-200/60 text-emerald-800 rounded-full">
              Exact Cent Match (100.0%)
            </span>
          </div>

          {payoutError && (
            <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
              {payoutError}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Step 2
            </button>

            <button
              type="button"
              disabled={isSendingPayout || !isExactPennyMatch || hasInvalidCrew || !customerPaymentCaptured || !jobId}
              onClick={handleSendPayout}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-base shadow-md transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600"
            >
              {isSendingPayout ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Submitting to PayPal Sandbox...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Approve & Send Payout via PayPal
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: RECEIPT & LIVE POLLING*/}
      {currentStep === 4 && (
        <section aria-labelledby="step4-heading" className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6">
          {(() => {
            const receiptAllocations = payoutResult?.allocations || calculatedAllocations;
            return (
              <>
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h1 id="step4-heading" className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                    Payout Batch Submitted
                  </h1>
                  <p className="text-sm text-slate-600 max-w-md mx-auto">
                    Your approval was processed. PayPal Sandbox is executing the batch payout with live status tracking.
                  </p>
                </div>

                {/* Batch Status Card */}
                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-xs font-bold uppercase text-slate-400">PayPal Batch ID</span>
                      <p className="font-mono text-sm font-bold text-slate-800">{payoutResult?.batchId || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">Live Status:</span>
                      {isPollingReceipt && <span className="text-[10px] text-slate-500">Checking item results...</span>}
                      <span
                        role="status"
                        aria-live="polite"
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${batchStatus === 'SUCCESS'
                          ? 'bg-emerald-100 text-emerald-800'
                          : batchStatus === 'PENDING' || batchStatus === 'PROCESSING'
                            ? 'bg-blue-100 text-blue-800 animate-pulse'
                            : 'bg-amber-100 text-amber-800'
                          }`}
                      >
                        {batchStatus}
                      </span>
                    </div>
                  </div>

                  {/* Recipients Live Status */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase text-slate-500 block">
                      Crew Delivery Confirmations
                    </span>
                    <div className="space-y-2">
                      {receiptAllocations.map((m: CrewMemberItem) => {
                        const itemStatus = String(itemStatuses[m.email] || 'PENDING').toUpperCase();
                        const isProblem = ['FAILED', 'BLOCKED', 'DENIED', 'CANCELED', 'REFUNDED', 'RETURNED', 'UNCLAIMED'].includes(itemStatus);
                        return (
                          <div
                            key={m.id}
                            className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900">{m.name}</span>
                              <span className="text-slate-400 font-mono text-[11px] block">{m.email}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-extrabold text-slate-900">${m.amountDollars}</span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${itemStatus === 'SUCCESS'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : isProblem
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}
                              >
                                {itemStatus === 'SUCCESS' ? 'Paid' : isProblem ? 'Problem' : 'Waiting'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                  <Link
                    href="/history"
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    View in Audit History &rarr;
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(1);
                      setJobId(null);
                      setPaypalOrderId(null);
                      setApprovalUrl(null);
                      setCustomerPaymentCaptured(false);
                      setCheckoutError(null);
                      setPayoutResult(null);
                      setBatchStatus('PENDING');
                      setItemStatuses({});
                      setIsPollingReceipt(false);
                    }}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-sm transition"
                  >
                    Start New Job Split
                  </button>
                </div>
              </>
            );
          })()}
        </section>
      )}
    </div>
  );
}

export default function SplitWizardPage() {
  return <ProtectedPage allowedRoles={['boss']}><SplitWizardContent /></ProtectedPage>;
}
