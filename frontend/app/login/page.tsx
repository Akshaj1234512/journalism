"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // A failed/expired magic link bounces back here with ?error=link.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "link") {
      setError(
        "That sign-in link didn't work — it may have expired or already been used. Request a fresh one below.",
      );
      setStatus("error");
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    if (!isSupabaseConfigured) {
      setError(
        "Sign-in isn't switched on yet. The site owner still needs to connect the accounts service.",
      );
      setStatus("error");
      return;
    }

    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  async function onGoogle() {
    if (!isSupabaseConfigured) {
      setError(
        "Sign-in isn't switched on yet. The site owner still needs to connect the accounts service.",
      );
      setStatus("error");
      return;
    }
    setError(null);
    const supabase = createClient();
    // Redirects the browser to Google; control returns to /auth/callback.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
            Pre-publication review
          </div>
          <h1 className="mt-1.5 font-serif text-[30px] italic leading-none tracking-tight text-neutral-900">
            The <span style={{ color: "#DC2626" }}>Red Room</span>
          </h1>
        </Link>

        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm">
          {status === "sent" ? (
            <div className="text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <MailGlyph />
              </div>
              <h2 className="mt-4 font-serif text-xl text-neutral-900">
                Check your email
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
                We sent a sign-in link to{" "}
                <span className="font-medium text-neutral-700">{email}</span>.
                Open it on this device to finish signing in. The link expires in
                an hour.
              </p>
              <button
                onClick={() => {
                  setStatus("idle");
                  setError(null);
                }}
                className="mt-5 text-[12.5px] font-medium text-rose-600 hover:text-rose-700"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-serif text-xl text-neutral-900">
                Sign in or create an account
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">
                Use your Google account, or get a one-time link by email.
                No password to remember.
              </p>

              <button
                type="button"
                onClick={onGoogle}
                className="mt-5 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <GoogleGlyph />
                Continue with Google
              </button>

              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-neutral-200" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  or
                </span>
                <span className="h-px flex-1 bg-neutral-200" />
              </div>

              <form onSubmit={onSubmit}>
                <label
                  htmlFor="email"
                  className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@newsroom.com"
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                />

                {status === "error" && error && (
                  <p className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] leading-snug text-rose-800">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                  {status === "sending" ? (
                    <>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      Sending link…
                    </>
                  ) : (
                    "Send sign-in link"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-neutral-400">
          By signing in you agree to let The Red Room store your drafts and
          review history on your account.
        </p>

        <Link
          href="/"
          className="mt-3 block text-center text-[12.5px] font-medium text-neutral-500 hover:text-neutral-800"
        >
          ← Back to the editor
        </Link>
      </div>
    </main>
  );
}

function MailGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M3 5.5 L10 10.5 L17 5.5" />
    </svg>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
