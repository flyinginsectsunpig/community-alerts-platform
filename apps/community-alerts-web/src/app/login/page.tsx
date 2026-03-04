"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Shield, AlertCircle, Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await login(username, password);
            router.push("/admin");
        } catch (err: any) {
            setError(err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full relative flex justify-center items-center min-h-full">
            {/* Glow Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-900/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-900/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10 px-8">
                <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl overflow-hidden relative">
                    {/* Top accent bar */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500" />

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 mb-4">
                            <Shield className="w-7 h-7 text-accent" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">
                            Admin Login
                        </h1>
                        <p className="text-text-secondary text-sm mt-2">
                            Sign in to access the admin portal
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl flex items-center gap-2 mb-6 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="username" className="form-label">Username</label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="form-input"
                                placeholder="admin"
                                autoComplete="username"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="form-label">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="form-input"
                                placeholder="••••••••"
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !username || !password}
                            className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer hint */}
                    <p className="text-center text-text-dim text-xs mt-6">
                        Default credentials: <span className="text-text-secondary font-mono">admin</span> / <span className="text-text-secondary font-mono">admin123</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
