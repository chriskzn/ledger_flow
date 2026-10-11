import { hasPermission, isKeyExpired } from "./permissions.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Principal = { userId: string; permissions: string[] };

async function authenticate(req: Request): Promise<Principal | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const apiKey = authHeader.replace("Bearer ", "").trim();
  if (!apiKey.startsWith("lf_")) return null;

  const keyHash = await hashKey(apiKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: keyRecord } = await adminClient
    .from("api_keys")
    .select("user_id, permissions, is_active, expires_at")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (!keyRecord || isKeyExpired(keyRecord.expires_at)) return null;
  const permissions = Array.isArray(keyRecord.permissions) ? keyRecord.permissions : [];
  return { userId: keyRecord.user_id, permissions };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const principal = await authenticate(req);
    if (!principal) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A service-role client bypasses RLS: enforce permissions here on every request.
    const required = req.method === "GET" ? 'read' : 'write';
    if (!hasPermission(principal.permissions, required)) {
      return new Response(JSON.stringify({ error: "Forbidden: insufficient API key permissions" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = principal.userId;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/functions\/v1\/ledgerflow-api/, "").replace(/^\//, "");

    const tables: Record<string, string> = {
      accounts: "accounts",
      journal: "journal_entries",
      invoices: "invoices",
      employees: "employees",
      customers: "customers",
      suppliers: "suppliers",
      payslips: "payslips",
    };

    if (req.method === "GET") {
      if (path === "" || path === "health") {
        return new Response(JSON.stringify({ status: "ok", service: "LedgerFlow API" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (path.startsWith("reports/")) {
        const reportType = path.replace("reports/", "");
        const { data: lines } = await adminClient
          .from("journal_lines")
          .select("debit, credit, account:accounts(id, code, name, type)")
          .eq("user_id", userId);

        const accountMap: Record<string, any> = {};
        (lines || []).forEach((line: any) => {
          const acc = line.account;
          if (!acc) return;
          if (!accountMap[acc.id]) accountMap[acc.id] = { account: acc, debit: 0, credit: 0 };
          accountMap[acc.id].debit += line.debit;
          accountMap[acc.id].credit += line.credit;
        });

        const balances = Object.values(accountMap).map((ab: any) => {
          const balance = ab.account.type === "asset" || ab.account.type === "expense"
            ? ab.debit - ab.credit
            : ab.credit - ab.debit;
          return { ...ab.account, balance };
        });

        if (reportType === "trial-balance") {
          return new Response(JSON.stringify({ balances }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (reportType === "income-statement") {
          const income = balances.filter((b) => b.type === "income");
          const expenses = balances.filter((b) => b.type === "expense");
          const totalIncome = income.reduce((s, b) => s + b.balance, 0);
          const totalExpenses = expenses.reduce((s, b) => s + b.balance, 0);
          return new Response(JSON.stringify({ income, expenses, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (reportType === "balance-sheet") {
          const assets = balances.filter((b) => b.type === "asset");
          const liabilities = balances.filter((b) => b.type === "liability");
          const equity = balances.filter((b) => b.type === "equity");
          return new Response(JSON.stringify({
            assets, liabilities, equity,
            totalAssets: assets.reduce((s, b) => s + b.balance, 0),
            totalLiabilities: liabilities.reduce((s, b) => s + b.balance, 0),
            totalEquity: equity.reduce((s, b) => s + b.balance, 0),
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (path.startsWith("sars/")) {
        const reportType = path.replace("sars/", "");
        const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1));
        const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));

        if (reportType === "emp201") {
          const { data: payslips } = await adminClient
            .from("payslips")
            .select("*")
            .eq("user_id", userId)
            .eq("pay_period_month", month)
            .eq("pay_period_year", year)
            .neq("status", "reversed");
          const totalPAYE = (payslips || []).reduce((s, p) => s + p.paye, 0);
          const totalUIF = (payslips || []).reduce((s, p) => s + p.uif + p.company_uif, 0);
          const totalSDL = (payslips || []).reduce((s, p) => s + p.company_sdl, 0);
          return new Response(JSON.stringify({ month, year, payslips, totalPAYE, totalUIF, totalSDL, total: totalPAYE + totalUIF + totalSDL }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (reportType === "vat201") {
          const { data: invoices } = await adminClient
            .from("invoices")
            .select("*")
            .eq("user_id", userId);
          const periodInvs = (invoices || []).filter((i) => {
            const d = new Date(i.invoice_date);
            return d.getMonth() + 1 === month && d.getFullYear() === year;
          });
          const vatOutput = periodInvs.reduce((s, i) => s + i.vat_amount, 0);
          return new Response(JSON.stringify({ month, year, vatOutput, vatInput: 0, vatPayable: vatOutput }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (path === "payroll/run") {
        const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1));
        const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));
        const { data: payslips } = await adminClient
          .from("payslips")
          .select("*, employee:employees(first_name, last_name)")
          .eq("user_id", userId)
          .eq("pay_period_month", month)
          .eq("pay_period_year", year);
        return new Response(JSON.stringify({ month, year, payslips }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tableName = tables[path];
      if (tableName) {
        const { data, error } = await adminClient
          .from(tableName)
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (req.method === "POST") {
      // Financial, payroll and security records require dedicated validated workflows.
      // Generic POST is deliberately limited to master-data entities.
      const writable: Record<string, string> = { customers: 'customers', suppliers: 'suppliers' };
      const tableName = writable[path];
      if (tableName) {
        const body = await req.json();
        if (!body || typeof body !== 'object' || Array.isArray(body) ||
            typeof body.name !== 'string' || !body.name.trim() ||
            Object.keys(body).some((key) => !['name', 'email', 'phone', 'vat_number', 'registration_number', 'address_line1', 'address_line2', 'city', 'postal_code', 'province', 'contact_person'].includes(key))) {
          return new Response(JSON.stringify({ error: 'Invalid master-data payload' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data, error } = await adminClient
          .from(tableName)
          .insert({ ...body, user_id: userId })
          .select()
          .single();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ data }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Endpoint not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
