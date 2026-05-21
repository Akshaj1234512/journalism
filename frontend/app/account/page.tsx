import { redirect } from "next/navigation";

import { AccountView } from "@/components/AccountView";
import type { Plan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!configured) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The profiles table may not exist yet (before schema.sql is run) — in
  // that case the query just returns null and we fall back to the free plan.
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, reviews_used, quota_reset_at, created_at")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AccountView
      email={user.email ?? ""}
      plan={(profile?.plan as Plan) ?? "free"}
      reviewsUsed={profile?.reviews_used ?? 0}
      quotaResetAt={profile?.quota_reset_at ?? null}
      memberSince={profile?.created_at ?? user.created_at ?? null}
    />
  );
}
