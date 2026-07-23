import "server-only";

// MedNecessity.ai Partner API client (spec §9).
// JSON REST over HTTPS, bearer token from env — never in source.
// Hierarchy: affiliate → clinic → provider, then IVR submissions.
// Runs in SIMULATED mode when MEDNECESSITY_API_KEY is unset (sandbox-less local
// dev, pre-BAA): registration returns fake IDs and IVRs go straight to
// GOOD_TO_ORDER on the first poll. Field names must be reconciled against the
// OpenAPI spec in the MedNecessity portal before go-live.

const BASE_URL = process.env.MEDNECESSITY_API_URL ?? "https://sandbox.mednecessity.ai/api/v1";
const API_KEY = process.env.MEDNECESSITY_API_KEY;

export const isSimulated = !API_KEY;

interface RequestOptions {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
}

async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`MedNecessity ${opts.method ?? "GET"} ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface ProviderRegistrationInput {
  practiceName: string;
  practiceType: string | null;
  organizationNpi: string | null;
  taxIdEin: string | null;
  ptan: string | null;
  address: { line1: string; line2: string | null; city: string; state: string; zip: string };
  phone: string | null;
  fax: string | null;
  contact: { name: string | null; email: string | null; phone: string | null };
  providerFirst: string;
  providerLast: string;
  credentials: string | null;
  individualNpi: string;
  taxonomy: string | null;
  licenseNumber: string | null;
  providerPtan: string | null;
}

export interface MedNecessityIds {
  affiliateId: string;
  clinicId: string;
  providerId: string;
}

/** Registers affiliate → clinic → provider; returns the three IDs (spec §4.4). */
export async function registerProvider(
  input: ProviderRegistrationInput,
  idempotencyKey: string,
): Promise<MedNecessityIds> {
  if (isSimulated) {
    const stub = idempotencyKey.slice(0, 8);
    return { affiliateId: `SIM-AFF-${stub}`, clinicId: `SIM-CLN-${stub}`, providerId: `SIM-PRV-${stub}` };
  }

  const affiliate = await api<{ id: string }>("/affiliates", {
    method: "POST",
    body: { name: "Agile Medical Group, LLC" },
    idempotencyKey: `${idempotencyKey}-affiliate`,
  });
  const clinic = await api<{ id: string }>("/clinics", {
    method: "POST",
    body: {
      affiliate_id: affiliate.id,
      name: input.practiceName,
      npi: input.organizationNpi,
      tax_id: input.taxIdEin,
      ptan: input.ptan,
      address: input.address,
      phone: input.phone,
      fax: input.fax,
      contact: input.contact,
    },
    idempotencyKey: `${idempotencyKey}-clinic`,
  });
  const provider = await api<{ id: string }>("/providers", {
    method: "POST",
    body: {
      clinic_id: clinic.id,
      first_name: input.providerFirst,
      last_name: input.providerLast,
      credentials: input.credentials,
      npi: input.individualNpi,
      taxonomy: input.taxonomy,
      license_number: input.licenseNumber,
      ptan: input.providerPtan,
    },
    idempotencyKey: `${idempotencyKey}-provider`,
  });
  return { affiliateId: affiliate.id, clinicId: clinic.id, providerId: provider.id };
}

export type IvrStatus = "RECEIVED" | "IN_REVIEW" | "GOOD_TO_ORDER" | "NEEDS_INFO" | "DENIED";

export interface IvrSubmissionResult {
  submissionId: string;
  status: IvrStatus;
  eligibility?: Record<string, unknown>;
  resultsPdfUrl?: string;
}

export async function submitIvr(
  payload: Record<string, unknown>,
  idempotencyKey: string,
): Promise<IvrSubmissionResult> {
  if (isSimulated) {
    return { submissionId: `SIM-IVR-${idempotencyKey.slice(0, 8)}`, status: "RECEIVED" };
  }
  const res = await api<{ id: string; status: IvrStatus }>("/ivr-submissions", {
    method: "POST",
    body: payload,
    idempotencyKey,
  });
  return { submissionId: res.id, status: res.status };
}

export async function getIvrSubmission(submissionId: string): Promise<IvrSubmissionResult> {
  if (isSimulated) {
    // Simulated IVRs clear immediately so the local order flow is exercisable.
    return {
      submissionId,
      status: "GOOD_TO_ORDER",
      eligibility: { simulated: true, payer: "SIMULATED PAYER", coverage: "eligible" },
      resultsPdfUrl: undefined,
    };
  }
  const res = await api<{
    id: string;
    status: IvrStatus;
    eligibility?: Record<string, unknown>;
    results_pdf_url?: string;
  }>(`/ivr-submissions/${submissionId}`);
  return {
    submissionId: res.id,
    status: res.status,
    eligibility: res.eligibility,
    resultsPdfUrl: res.results_pdf_url,
  };
}
