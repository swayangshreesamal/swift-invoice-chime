import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    // Automated cron endpoint triggered daily by Vercel or external scheduler
    if (url.pathname === "/api/cron/reminders") {
      try {
        const { processAllOverdueReminders } = await import("./lib/reminder-runner.server");
        const result = await processAllOverdueReminders();
        return new Response(
          JSON.stringify({ ok: true, timestamp: new Date().toISOString(), result }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ ok: false, error }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // Direct manual reminder trigger endpoint (called by frontend button clicks)
    if (url.pathname === "/api/reminders/send" && request.method === "POST") {
      try {
        const body = (await request.json()) as any;
        const invoiceId = body.invoiceId || body.id;
        const stage = Number(body.stage) as 3 | 7 | 14;

        if (!invoiceId || !stage) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing invoiceId or stage" }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        const { sendManualInvoiceReminder } = await import("./lib/reminder-runner.server");
        const result = await sendManualInvoiceReminder(invoiceId, stage, body);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { "content-type": "application/json" },
        });
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ success: false, error }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // Direct batch scan/trigger endpoint
    if (url.pathname === "/api/reminders/batch" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => ({}))) as any;
        const { processAllOverdueReminders } = await import("./lib/reminder-runner.server");
        const result = await processAllOverdueReminders(body?.invoices);
        return new Response(JSON.stringify({ ok: true, result }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ ok: false, error }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // Email delivery test endpoint to verify SMTP credentials and inbox reception
    if (url.pathname === "/api/reminders/test") {
      try {
        const recipient =
          url.searchParams.get("to") ||
          process.env["TEST_RECIPIENT"] ||
          "sswayamsree@gmail.com";
        const { sendReminderEmail } = await import("./lib/email-service.server");

        const result = await sendReminderEmail({
          clientName: "Valued Client",
          clientEmail: recipient,
          amount: 750,
          dueDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
          description: "Verification of PayReminder email notification service",
          stage: 3,
          daysOverdue: 3,
        });

        return new Response(
          JSON.stringify({
            ok: result.success,
            recipient,
            result,
            smtpUser: process.env["SMTP_USER"] || "payreminder.help@gmail.com",
          }),
          {
            status: result.success ? 200 : 500,
            headers: { "content-type": "application/json" },
          },
        );
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ ok: false, error }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
