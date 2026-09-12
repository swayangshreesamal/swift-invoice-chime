export type InvoiceMetadata = {
  payment_details?: string | null;
  client_notes?: string | null;
  late_fee?: string | null;
};

// Matches full or truncated metadata tag at end of string or anywhere
const METADATA_TAG_REGEX = /\s*\[METADATA:([\s\S]*?)\]\s*$/;
const CORRUPTED_METADATA_REGEX = /\s*\[METADATA:[\s\S]*$/i;

/**
 * Strips any metadata envelope (complete or incomplete/truncated) from the description
 * so human readers, forms, and email previews ONLY see the clean description text.
 */
export function cleanDescription(rawDescription: string | null | undefined): string {
  if (!rawDescription) return "";
  return rawDescription.replace(CORRUPTED_METADATA_REGEX, "").trim();
}

/**
 * Robustly unpacks metadata from raw description.
 * Handles both valid JSON envelopes and truncated envelopes (e.g. from column width cutoffs).
 */
export function unpackInvoiceMetadata(rawDescription: string | null | undefined): {
  cleanDescription: string;
  payment_details?: string | null;
  client_notes?: string | null;
  late_fee?: string | null;
} {
  if (!rawDescription) {
    return { cleanDescription: "" };
  }

  const clean = cleanDescription(rawDescription);

  // Try standard JSON match first
  const match = rawDescription.match(METADATA_TAG_REGEX);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      return {
        cleanDescription: clean,
        payment_details: typeof parsed.pd === "string" ? parsed.pd : null,
        client_notes: typeof parsed.cn === "string" ? parsed.cn : null,
        late_fee: typeof parsed.lf === "string" ? parsed.lf : null,
      };
    } catch {
      // Fallback to regex extraction below if JSON was malformed
    }
  }

  // Resilient regex extractor for truncated or unclosed metadata strings
  if (rawDescription.includes("[METADATA:")) {
    const pdMatch = rawDescription.match(/"pd"\s*:\s*"([^"]*)(?:"|$)/);
    const cnMatch = rawDescription.match(/"cn"\s*:\s*"([^"]*)(?:"|$)/);
    const lfMatch = rawDescription.match(/"lf"\s*:\s*"([^"]*)(?:"|$)/);

    return {
      cleanDescription: clean,
      payment_details: pdMatch ? pdMatch[1] : null,
      client_notes: cnMatch ? cnMatch[1] : null,
      late_fee: lfMatch ? lfMatch[1] : null,
    };
  }

  return { cleanDescription: clean };
}

/**
 * Description is kept 100% clean so metadata is never visible in user form fields.
 */
export function packInvoiceMetadata(
  description: string | null | undefined,
  _meta?: InvoiceMetadata,
): string | null {
  const clean = cleanDescription(description);
  return clean || null;
}

const LOCAL_STORAGE_PREFIX = "payreminder_meta_";

/**
 * Saves invoice metadata in browser localStorage for offline/client resilience.
 */
export function saveLocalInvoiceMeta(invoiceId: string, meta: InvoiceMetadata): void {
  if (typeof window === "undefined" || !invoiceId) return;
  try {
    const key = `${LOCAL_STORAGE_PREFIX}${invoiceId}`;
    const cleanMeta: InvoiceMetadata = {
      payment_details: meta.payment_details?.trim() || null,
      client_notes: meta.client_notes?.trim() || null,
      late_fee: meta.late_fee?.trim() || null,
    };
    window.localStorage.setItem(key, JSON.stringify(cleanMeta));
  } catch (err) {
    console.warn("Failed to persist local invoice meta:", err);
  }
}

/**
 * Retrieves invoice metadata from browser localStorage.
 */
export function getLocalInvoiceMeta(invoiceId: string): InvoiceMetadata {
  if (typeof window === "undefined" || !invoiceId) return {};
  try {
    const key = `${LOCAL_STORAGE_PREFIX}${invoiceId}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    return JSON.parse(raw) as InvoiceMetadata;
  } catch {
    return {};
  }
}

export type BaseInvoice = {
  id: string;
  client_name: string;
  client_email: string;
  amount: number;
  invoice_date: string;
  due_date: string;
  description?: string | null;
  payment_details?: string | null;
  client_notes?: string | null;
  late_fee?: string | null;
  status: string;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
};

/**
 * Resolves an invoice by combining database columns, user_metadata server store,
 * local storage, and profile default fallback. Always ensures description is clean.
 */
export function resolveInvoice<T extends BaseInvoice>(
  inv: T,
  defaultPaymentDetails?: string | null,
  userInvoicesMeta?: Record<string, InvoiceMetadata> | null,
): T {
  const unpacked = unpackInvoiceMetadata(inv.description);
  const local = getLocalInvoiceMeta(inv.id);
  const serverMeta = userInvoicesMeta?.[inv.id] || {};

  const payment_details =
    inv.payment_details ||
    serverMeta.payment_details ||
    unpacked.payment_details ||
    local.payment_details ||
    defaultPaymentDetails ||
    null;

  const client_notes =
    inv.client_notes ||
    serverMeta.client_notes ||
    unpacked.client_notes ||
    local.client_notes ||
    null;

  const late_fee =
    inv.late_fee ||
    serverMeta.late_fee ||
    unpacked.late_fee ||
    local.late_fee ||
    null;

  return {
    ...inv,
    description: unpacked.cleanDescription || null,
    payment_details,
    client_notes,
    late_fee,
  };
}
