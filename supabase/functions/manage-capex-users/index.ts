import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

type Role = "admin" | "viewer";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Sessão ausente." }, 401);

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Sessão inválida." }, 401);

    const { data: caller } = await adminClient.from("profiles").select("role,is_active,email").eq("id", user.id).single();
    if (!caller || caller.role !== "admin" || caller.is_active !== true) return json({ error: "Somente administradores ativos." }, 403);

    const body = await req.json();
    const action = String(body.action || "");
    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const fullName = String(body.full_name || "").trim();
      const role: Role = body.role === "admin" ? "admin" : "viewer";
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Informe um e-mail válido.");
      if (fullName.length < 2) throw new Error("Informe o nome completo.");
      if (password.length < 12) throw new Error("A senha deve ter pelo menos 12 caracteres.");
      const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true,
        user_metadata: { full_name: fullName }, app_metadata: { app_role: role, must_change_password: true } });
      if (error) throw error;
      await adminClient.from("profiles").update({ email, full_name: fullName, role, is_active: true, must_change_password: true }).eq("id", data.user.id);
      await adminClient.from("audit_log").insert({ table_name: "profiles", record_id: data.user.id, operation: "USER_CREATED", actor_id: user.id, actor_email: caller.email, new_data: { email, full_name: fullName, role } });
      return json({ ok: true });
    }
    const targetId = String(body.user_id || "");
    if (!targetId) throw new Error("Usuário não informado.");
    if (targetId === user.id) throw new Error("Você não pode aplicar esta ação à própria conta.");
    if (action === "set_active") {
      const active = body.is_active === true;
      const { error } = await adminClient.from("profiles").update({ is_active: active }).eq("id", targetId); if (error) throw error;
      if (!active) await adminClient.auth.admin.signOut(targetId, "global");
      return json({ ok: true });
    }
    if (action === "set_role") {
      const role: Role = body.role === "admin" ? "admin" : "viewer";
      const { data: target, error: getError } = await adminClient.auth.admin.getUserById(targetId); if (getError || !target.user) throw getError || new Error("Usuário não encontrado.");
      const { error } = await adminClient.from("profiles").update({ role }).eq("id", targetId); if (error) throw error;
      await adminClient.auth.admin.updateUserById(targetId, { app_metadata: { ...target.user.app_metadata, app_role: role } });
      await adminClient.auth.admin.signOut(targetId, "global");
      return json({ ok: true });
    }
    if (action === "reset_password") {
      const password = String(body.password || ""); if (password.length < 12) throw new Error("A senha deve ter pelo menos 12 caracteres.");
      const { error } = await adminClient.auth.admin.updateUserById(targetId, { password, app_metadata: { must_change_password: true } }); if (error) throw error;
      await adminClient.from("profiles").update({ must_change_password: true }).eq("id", targetId);
      await adminClient.auth.admin.signOut(targetId, "global");
      return json({ ok: true });
    }
    throw new Error("Ação inválida.");
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Erro interno." }, 400);
  }
});
