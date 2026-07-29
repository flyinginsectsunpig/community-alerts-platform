"use client";

import { useState } from "react";

import ModalOverlay from "./ModalOverlay";
import { api, ApiError } from "@/lib/api";
import { storeSession, type AuthSession } from "@/lib/auth";

interface AuthModalProps {
  onClose: () => void;
  onAuthed: (session: AuthSession) => void;
}

type Mode = "signin" | "signup" | "reset";

export default function AuthModal({ onClose, onAuthed }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetRequested, setResetRequested] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setResetRequested(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    if (mode === "reset") {
      try {
        await api.requestPasswordReset(email.trim());
        setResetRequested(true);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Something went wrong — try again");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    try {
      const response =
        mode === "signup"
          ? await api.signup({ email: email.trim(), displayName: displayName.trim(), password })
          : await api.login({ email: email.trim(), password });
      const session: AuthSession = {
        token: response.token,
        userId: response.userId,
        displayName: response.displayName,
        email: response.email,
        expiresAt: response.expiresAt,
      };
      storeSession(session);
      onAuthed(session);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong — try again");
      setSubmitting(false);
    }
  }

  return (
    <ModalOverlay label="Sign in or create an account" onClose={onClose}>
      <form className="panel" onSubmit={handleSubmit}>
        <div className="panel__header">
          <h2>
            {mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create an account"
                : "Reset your password"}
          </h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {mode !== "reset" && (
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={`auth-tab${mode === "signin" ? " auth-tab--active" : ""}`}
            onClick={() => switchMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={`auth-tab${mode === "signup" ? " auth-tab--active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Sign up
          </button>
        </div>
        )}

        {mode === "reset" && resetRequested ? (
          <p className="panel__hint">
            If that email has an account, a reset link is on its way. The link
            works once and expires in an hour.
          </p>
        ) : (
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            // useFocusCapture focuses this once the dialog has painted. React's
            // autoFocus fires during commit instead, which raced the hook.
            data-autofocus
            required
          />
        </label>
        )}

        {mode === "signup" && (
          <label className="field">
            <span>Display name (shown on your comments)</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={60}
              autoComplete="nickname"
              required
            />
          </label>
        )}

        {mode !== "reset" && (
        <label className="field">
          <span>Password{mode === "signup" ? " (at least 8 characters)" : ""}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={mode === "signup" ? 8 : undefined}
            maxLength={72}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />
        </label>
        )}

        {mode === "signin" && (
          <button type="button" className="link-button" onClick={() => switchMode("reset")}>
            Forgot your password?
          </button>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="panel__actions">
          {!(mode === "reset" && resetRequested) && (
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting
                ? "Working…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {mode === "reset" && resetRequested ? "Close" : "Cancel"}
          </button>
        </div>

        {mode === "reset" ? (
          <button type="button" className="link-button" onClick={() => switchMode("signin")}>
            Back to sign in
          </button>
        ) : (
          <p className="panel__hint">
            An account is needed to report, confirm, and discuss alerts — watch
            zones work without one.
          </p>
        )}
      </form>
    </ModalOverlay>
  );
}
