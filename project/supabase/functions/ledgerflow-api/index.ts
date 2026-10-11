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

async function authenticate(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const apiKey = authHeader.replace("Bearer ", "").trim();
  if (!apiKey.startsWith("lf_")) return null;

  const keyHash = await hashKey(apiKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: keyRecord } = await adminClient
    .from("api_keys")
    .select("user_id, permissions, is_active")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (!keyRecord) return null;
  return keyRecord.user_id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const userId = await authenticate(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      const tableName = tables[path];
      if (tableName) {
        const body = await req.json();
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
