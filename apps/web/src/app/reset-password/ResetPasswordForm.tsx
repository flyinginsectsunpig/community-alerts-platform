"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";

export default function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Something went wrong — try again",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="panel">
        <h2>Reset your password</h2>
        <p className="panel__hint">
          This page needs the reset link from your email — the token is missing.
          Request a new link from the sign-in screen.
        </p>
        <Link className="btn" href="/">
          Back to the dashboard
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="panel">
        <h2>Password updated</h2>
        <p className="panel__hint">You can sign in with your new password now.</p>
        <Link className="btn btn--primary" href="/">
          Back to the dashboard
        </Link>
      </div>
    );
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>Choose a new password</h2>
      <label className="field">
        <span>New password (at least 8 characters)</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          autoFocus
          required
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="panel__actions">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? "Working…" : "Set new password"}
        </button>
      </div>
    </form>
  );
}
