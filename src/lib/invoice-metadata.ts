export type InvoiceMetadata = {
  payment_details?: string | null;
  client_notes?: string | null;
  late_fee?: string | null;
};

const METADATA_TAG_REGEX = /\n?\[METADATA:([\s\S]*?)\]\s*$/;

/**
 * Packs extended attributes into a standardized metadata envelope appended to description.
 * This allows storage in the core Postgres TEXT description column even when dedicated
 * columns are not present in the database schema.
 */
export function packInvoiceMetadata(
  description: string | null | undefined,
  meta: InvoiceMetadata,
): string | null {
  const cleanDesc = cleanDescription(description);
  const pd = meta.payment_details?.trim() || undefined;
  const cn = meta.client_notes?.trim() || undefined;
  const lf = meta.late_fee?.trim() || undefined;

  if (!pd && !cn && !lf) {
    return cleanDesc || null;
  }

  const payload = JSON.stringify({ pd, cn, lf });
  const envelope = `[METADATA:${payload}]`;

  return cleanDesc ? `${cleanDesc}\n${envelope}` : envelope;
}

/**
 * Strips any metadata envelope from the description so that human readers, clients,
 * and email previews only see the clean description text.
 */
export function cleanDescription(rawDescription: string | null | undefined): string {
  if (!rawDescription) return "";
  return rawDescription.replace(METADATA_TAG_REGEX, "").trim();
}

/**
 * Unpacks the metadata envelope from the raw description.
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

  const match = rawDescription.match(METADATA_TAG_REGEX);
  const clean = cleanDescription(rawDescription);

  if (!match) {
    return { cleanDescription: clean };
  }

  try {
    const parsed = JSON.parse(match[1]);
    return {
      cleanDescription: clean,
      payment_details: typeof parsed.pd === "string" ? parsed.pd : null,
      client_notes: typeof parsed.cn === "string" ? parsed.cn : null,
      late_fee: typeof parsed.lf === "string" ? parsed.lf : null,
    };
  } catch {
    return { cleanDescription: clean };
  }
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
 * Resolves an invoice by combining database columns, packed metadata envelope,
 * local storage, and profile default fallback.
 */
export function resolveInvoice<T extends BaseInvoice>(
  inv: T,
  defaultPaymentDetails?: string | null,
): T {
  const unpacked = unpackInvoiceMetadata(inv.description);
  const local = getLocalInvoiceMeta(inv.id);

  const payment_details =
    inv.payment_details ||
    unpacked.payment_details ||
    local.payment_details ||
    defaultPaymentDetails ||
    null;

  const client_notes =
    inv.client_notes ||
    unpacked.client_notes ||
    local.client_notes ||
    null;

  const late_fee =
    inv.late_fee ||
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
