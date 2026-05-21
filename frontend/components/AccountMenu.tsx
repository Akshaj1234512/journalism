"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PLANS, type Plan } from "@/lib/plans";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// Header widget: a "Sign in" link when logged out, an account chip with a
// dropdown (Account page + sign out) when logged in. Renders nothing until
// Supabase is connected, so the site works unchanged before then.
export function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setEmail(user?.email ?? null);
      if (user) {
        // profiles may not exist yet (before schema.sql is run) — that just
        // leaves the plan at its 'free' default.
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.plan) setPlan(profile.plan as Plan);
      }
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      if (!session) setPlan("free");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function onSignOut() {
    if (!isSupabaseConfigured) return;
    await createClient().auth.signOut();
    setOpen(false);
  }

  if (!isSupabaseConfigured || !ready) return null;

  if (!email) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
      >
        Sign in
      </Link>
    );
  }

  const initial = email[0]?.toUpperCase() ?? "?";

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white py-1.5 pl-1.5 pr-2.5 text-sm text-neutral-700 transition hover:bg-neutral-50"
        aria-label="Account menu"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-lg text-[12px] font-semibold text-white"
          style={{ backgroundColor: "#DC2626" }}
        >
          {initial}
        </span>
        <span className="hidden max-w-[140px] truncate sm:inline">{email}</span>
        <ChevronGlyph />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 px-3.5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Signed in as
            </div>
            <div className="mt-0.5 truncate text-[13px] font-medium text-neutral-800">
              {email}
            </div>
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-[10.5px] font-medium text-neutral-600">
              {PLANS[plan].label} plan
            </div>
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-neutral-700 transition hover:bg-neutral-50"
          >
            <GearGlyph />
            Account &amp; plan
          </Link>
          <button
            onClick={onSignOut}
            className="flex w-full items-center gap-2.5 border-t border-neutral-100 px-3.5 py-2.5 text-left text-[13px] text-neutral-700 transition hover:bg-neutral-50"
          >
            <SignOutGlyph />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 4.5 L6 7.5 L9 4.5" />
    </svg>
  );
}

function GearGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8 3.4 3.4" />
    </svg>
  );
}

function SignOutGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6" />
      <path d="M10.5 11 13.5 8l-3-3M13.5 8H6" />
    </svg>
  );
}
