// ============================================================
// WMDM Desktop App — Login Page
// Full-screen login + registration with WMDM branding
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-shell";
import { useAuthStore } from "../stores/authStore";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2.5 2.5l13 13" />
        <path d="M7.3 7.35a2.25 2.25 0 003.35 3.3" />
        <path d="M4.2 4.2C2.9 5.2 1.8 6.8 1.2 9c1.2 4 4.2 6 7.8 6 1.5 0 2.9-.4 4-1" />
        <path d="M14.5 12.5c1-1 1.8-2.3 2.3-3.5-1.2-4-4.2-6-7.8-6-.7 0-1.3.1-2 .2" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1.2 9c1.2-4 4.2-6 7.8-6s6.6 2 7.8 6c-1.2 4-4.2 6-7.8 6S2.4 13 1.2 9z" />
      <circle cx="9" cy="9" r="2.25" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <path d="M16 9a7 7 0 00-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ErrorBanner({ error, onClear }: { error: string; onClear: () => void }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-start gap-3">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-red-400 shrink-0 mt-0.5">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 5.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="9" cy="12" r="0.75" fill="currentColor" />
      </svg>
      <p className="text-sm text-red-400 flex-1">{error}</p>
      <button type="button" onClick={onClear} className="ml-auto text-red-400/60 hover:text-red-400">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 flex items-start gap-3">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-emerald-400 shrink-0 mt-0.5">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-sm text-emerald-400 flex-1">{message}</p>
    </div>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    try {
      await login(email.trim(), password);
      // Check if first run — show welcome wizard
      try {
        const tauri = await import("../api/tauri");
        const settings = await tauri.getSettings();
        if (settings.firstRunComplete) {
          navigate("/library");
        } else {
          navigate("/welcome");
        }
      } catch {
        navigate("/welcome");
      }
    } catch {
      // Error is set in the store
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !firstName.trim() || !lastName.trim()) return;

    if (password !== confirmPassword) {
      // Manually set error (not in store since it's a client-side validation)
      clearError();
      useAuthStore.setState({ error: "Passwords do not match." });
      return;
    }

    if (password.length < 8) {
      clearError();
      useAuthStore.setState({ error: "Password must be at least 8 characters." });
      return;
    }

    try {
      await register(email.trim(), password, firstName.trim(), lastName.trim());
      setRegistrationSuccess(true);
      navigate("/welcome");
    } catch {
      // Error is set in the store
    }
  };

  const switchMode = (newMode: "login" | "register") => {
    setMode(newMode);
    clearError();
    setRegistrationSuccess(false);
    setShowPassword(false);
    setConfirmPassword("");
  };

  const handleForgotPassword = () => {
    open("https://www.wemakedancemusic.com/customer/account/forgotpassword/");
  };

  const isLoginValid = email.trim() && password.trim();
  const isRegisterValid =
    email.trim() &&
    password.trim() &&
    confirmPassword.trim() &&
    firstName.trim() &&
    lastName.trim();

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-wmdm-bg relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-wmdm-accent/[0.03] blur-3xl" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-violet-600/[0.03] blur-3xl" />
      </div>

      {/* Drag region for title bar */}
      <div data-tauri-drag-region className="absolute top-0 left-0 right-0 h-12" />

      {/* Login/Register card */}
      <div className="relative w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img
            src="/wmdm-logo.png"
            alt="WMDM"
            className="w-16 h-16 rounded-2xl mb-4 shadow-lg"
          />
          <h1 className="text-2xl font-bold text-wmdm-text">WMDM</h1>
          <p className="text-sm text-wmdm-text-muted mt-1">Desktop</p>
          <button
            onClick={() => open("https://www.wmdm.io")}
            className="text-xs text-wmdm-accent hover:text-wmdm-accent-hover mt-2 transition-colors"
          >
            www.wmdm.io
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex mb-5 bg-wmdm-surface rounded-lg p-1 border border-wmdm-border">
          <button
            onClick={() => switchMode("login")}
            className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
              mode === "login"
                ? "bg-wmdm-accent text-white"
                : "text-wmdm-text-muted hover:text-wmdm-text"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => switchMode("register")}
            className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${
              mode === "register"
                ? "bg-wmdm-accent text-white"
                : "text-wmdm-text-muted hover:text-wmdm-text"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={mode === "login" ? handleLogin : handleRegister}
          className="space-y-4"
        >
          {/* Messages */}
          {error && <ErrorBanner error={error} onClear={clearError} />}
          {registrationSuccess && (
            <SuccessBanner message="Welcome! Check your email for your free template download." />
          )}

          {/* Registration: Name fields */}
          {mode === "register" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-xs font-medium text-wmdm-text-muted mb-1.5">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  autoComplete="given-name"
                  className="input-base"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-xs font-medium text-wmdm-text-muted mb-1.5">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  autoComplete="family-name"
                  className="input-base"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-wmdm-text-muted mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus={mode === "login"}
              autoComplete="email"
              className="input-base"
              disabled={isLoading}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-wmdm-text-muted mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "Min. 8 characters" : "Enter your password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="input-base pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-wmdm-text-muted hover:text-wmdm-text transition-default"
                tabIndex={-1}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {/* Confirm Password (register only) */}
          {mode === "register" && (
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-wmdm-text-muted mb-1.5">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                className="input-base"
                disabled={isLoading}
              />
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading || (mode === "login" ? !isLoginValid : !isRegisterValid)}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Spinner />
                <span>{mode === "login" ? "Signing in..." : "Creating account..."}</span>
              </>
            ) : (
              <span>{mode === "login" ? "Sign In" : "Create Account"}</span>
            )}
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-6 text-center space-y-3">
          {mode === "login" && (
            <button
              onClick={handleForgotPassword}
              className="text-xs text-wmdm-accent hover:text-wmdm-accent-hover transition-default"
            >
              Forgot password?
            </button>
          )}
          <p className="text-[11px] text-wmdm-text-muted/60">
            {mode === "login"
              ? "Sign in with your wemakedancemusic.com account"
              : "Create a free account to start downloading"}
          </p>
        </div>
      </div>
    </div>
  );
}
