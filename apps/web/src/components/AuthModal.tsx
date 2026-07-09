"use client";

import { useState } from "react";

import ModalOverlay from "./ModalOverlay";
import { api, ApiError } from "@/lib/api";
import { storeSession, type AuthSession } from "@/lib/auth";

interface AuthModalProps {
  onClose: () => void;
  onAuthed: (session: AuthSession) => void;
}

type Mode = "signin" | "signup";

export default function AuthModal({ onClose, onAuthed }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
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
          <h2>{mode === "signin" ? "Sign in" : "Create an account"}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

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

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
        </label>

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

        {error && <p className="form-error">{error}</p>}

        <div className="panel__actions">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>

        <p className="panel__hint">
          Reporting stays anonymous — an account is only needed to join alert discussions.
        </p>
      </form>
    </ModalOverlay>
  );
}
