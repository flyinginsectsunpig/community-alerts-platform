"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Clock, Loader2, BarChart3, LogOut, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { communityApi } from "@/lib/api";
import { mapSuburb, mapIncident } from "@/lib/mappers";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";

type JobStatus = "QUEUED" | "RUNNING" | "FINALIZING" | "DONE" | "ERROR";

interface ImportJob {
    jobId: string;
    status: JobStatus;
    rowsProcessed: number;
    incidentsAdded: number;
    suburbsAdded: number;
    errorMessage: string | null;
}

function extractJobIdFromResponse(payload: unknown): string | undefined {
    if (payload && typeof payload === "object") {
        const obj = payload as Record<string, unknown>;
        const candidates = [obj.jobId, obj.jobID, obj.id];
        const found = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
        if (typeof found === "string") return found;
    }

    // Backward-compatible fallback: plain string response body.
    if (typeof payload === "string" && payload.trim().length > 0) {
        return payload.trim();
    }

    return undefined;
}

function extractLegacyStatus(payload: unknown): Partial<ImportJob> | null {
    if (!payload || typeof payload !== "object") return null;
    const obj = payload as Record<string, unknown>;

    const hasCounters =
        typeof obj.rowsProcessed === "number" ||
        typeof obj.incidentsAdded === "number" ||
        typeof obj.suburbsAdded === "number";

    if (!hasCounters) return null;

    const statusValue = typeof obj.status === "string" ? obj.status : "DONE";
    const normalizedStatus: JobStatus =
        statusValue === "QUEUED" || statusValue === "RUNNING" || statusValue === "FINALIZING" || statusValue === "DONE" || statusValue === "ERROR"
            ? statusValue
            : "DONE";

    return {
        status: normalizedStatus,
        rowsProcessed: typeof obj.rowsProcessed === "number" ? obj.rowsProcessed : 0,
        incidentsAdded: typeof obj.incidentsAdded === "number" ? obj.incidentsAdded : 0,
        suburbsAdded: typeof obj.suburbsAdded === "number" ? obj.suburbsAdded : 0,
        errorMessage: typeof obj.errorMessage === "string" ? obj.errorMessage : null,
    };
}

export default function AdminPage() {
    const { setIncidents, setSuburbs } = useStore();
    const { user, isAuthenticated, logout } = useAuth();
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [job, setJob] = useState<ImportJob | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const [clearing, setClearing] = useState(false);
    const [clearMsg, setClearMsg] = useState<string | null>(null);

    // Client-side auth guard (complements edge middleware)
    useEffect(() => {
        if (!isAuthenticated) {
            router.replace("/login");
        }
    }, [isAuthenticated, router]);

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    const refreshGlobalStore = useCallback(async () => {
        try {
            const [suburbsRaw, incidentsRaw] = await Promise.all([
                communityApi.getSuburbs() as Promise<any[]>,
                communityApi.getIncidents(200) as Promise<any>,
            ]);

            const suburbs = (suburbsRaw ?? []).map(mapSuburb);
            const incidents = (incidentsRaw?.content ?? incidentsRaw ?? []).map(mapIncident);

            if (suburbs.length) setSuburbs(suburbs);
            if (incidents.length) setIncidents(incidents);
        } catch (e) {
            console.error("Failed to refresh store data after upload", e);
        }
    }, [setIncidents, setSuburbs]);

    const baseUrl = '/api-proxy/java';

    const authHeaders = (): Record<string, string> => {
        if (user?.token) return { Authorization: `Bearer ${user.token}` };
        return {};
    };

    // ── Polling ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!job?.jobId || job.status === "DONE" || job.status === "ERROR") {
            if (pollRef.current) clearInterval(pollRef.current);
            return;
        }

        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${baseUrl}/api/admin/upload/status/${job.jobId}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        setError("Import job not found. Please upload the file again.");
                    } else {
                        setError(`Failed to refresh import status (${res.status}).`);
                    }
                    if (pollRef.current) clearInterval(pollRef.current);
                    return;
                }

                const updated: ImportJob = await res.json();
                setJob(updated);

                if (updated.status === "DONE") {
                    refreshGlobalStore();
                }
            } catch {
                // Network blip — keep polling
            }
        }, 2000);

        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [job?.jobId, job?.status, baseUrl, refreshGlobalStore]);

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setJob(null);
            setError(null);
        }
    };

    const handleClear = async () => {
        if (!confirm("This will delete all SAPS-imported incidents and their suburbs. Seeded data is kept. Continue?")) return;
        setClearing(true);
        setClearMsg(null);
        try {
            const res = await fetch(`${baseUrl}/api/admin/imported-data/clear`, {
                method: "POST",
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error(`Clear failed with status ${res.status}`);
            setClearMsg("Cleared — imported data is being deleted in the background.");
            // Refresh the store so the map updates
            setTimeout(refreshGlobalStore, 3000);
        } catch (err: any) {
            setClearMsg(`Error: ${err.message}`);
        } finally {
            setClearing(false);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setUploading(true);
        setError(null);
        setJob(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${baseUrl}/api/admin/upload`, {
                method: "POST",
                headers: authHeaders(),
                body: formData,
            });

            if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);

            // Server usually returns JSON { jobId }, but tolerate older/plain formats.
            const raw = await res.text();
            let parsed: unknown = raw;
            try {
                parsed = JSON.parse(raw);
            } catch {
                // Keep raw string payload.
            }

            const jobId = extractJobIdFromResponse(parsed);
            if (jobId) {
                setJob({
                    jobId,
                    status: "QUEUED",
                    rowsProcessed: 0,
                    incidentsAdded: 0,
                    suburbsAdded: 0,
                    errorMessage: null,
                });
                return;
            }

            const legacy = extractLegacyStatus(parsed);
            if (legacy) {
                // Some backend builds return progress/result object directly from /upload.
                // Use a synthetic id and do not poll when already DONE/ERROR.
                const finalStatus = legacy.status ?? "DONE";
                setJob({
                    jobId: "legacy-upload",
                    status: finalStatus,
                    rowsProcessed: legacy.rowsProcessed ?? 0,
                    incidentsAdded: legacy.incidentsAdded ?? 0,
                    suburbsAdded: legacy.suburbsAdded ?? 0,
                    errorMessage: legacy.errorMessage ?? null,
                });
                if (finalStatus === "DONE") {
                    refreshGlobalStore();
                }
                return;
            }

            const preview = raw.slice(0, 200).trim() || "<empty response>";
            throw new Error(`Upload succeeded but server did not return a valid jobId. Response: ${preview}`);
        } catch (err: any) {
            setError(err.message || "An error occurred during upload");
        } finally {
            setUploading(false);
        }
    };

    // ── Status helpers ─────────────────────────────────────────────────────
    const statusLabel: Record<JobStatus, string> = {
        QUEUED: "Queued — waiting for worker…",
        RUNNING: "Processing rows…",
        FINALIZING: "Finalizing — recalculating heat scores…",
        DONE: "Import Complete",
        ERROR: "Import Failed",
    };

    const isProcessing = job && (job.status === "QUEUED" || job.status === "RUNNING" || job.status === "FINALIZING");
    const isDone = job?.status === "DONE";
    const isError = job?.status === "ERROR";

    return (
        <div className="w-full relative flex justify-center items-start pt-24 min-h-full">
            {/* Glow Effects */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-900/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-3xl relative z-10 px-8">
                <header className="mb-10 text-center">
                    <h1 className="text-4xl font-black text-white mb-3 tracking-tight">
                        Admin Portal
                    </h1>
                    <p className="text-gray-400 text-lg">
                        Manage system settings and import data
                    </p>
                </header>

                <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500" />

                    <h2 className="text-2xl font-bold text-text-primary mb-6 flex items-center gap-3">
                        <FileSpreadsheet className="text-red-500" size={28} />
                        SAPS Crime Stats Upload
                    </h2>

                    <form onSubmit={handleUpload} className="space-y-6">
                        {/* Drop-zone */}
                        <div
                            className={`border-2 border-dashed rounded-xl p-10 transition-all duration-300 text-center flex flex-col items-center justify-center gap-4 relative ${file ? "border-red-500/50 bg-red-500/5" : "border-border bg-surface2 hover:border-text-secondary"
                                }`}
                        >
                            <Upload className={`w-12 h-12 mb-2 ${file ? "text-red-400" : "text-text-dim"}`} />
                            <div className="text-text-secondary">
                                {file ? (
                                    <span className="font-semibold text-text-primary">{file.name}</span>
                                ) : (
                                    <span>Drag and drop your <span className="text-accent font-semibold">.xlsx</span> file here, or click to browse</span>
                                )}
                            </div>
                            <input
                                type="file"
                                accept=".xlsx"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <p>{error}</p>
                            </div>
                        )}

                        {/* ── Job progress card ─────────────────────────────── */}
                        {job && (
                            <div className={`rounded-xl border p-6 flex flex-col gap-4 transition-all duration-500 ${isDone ? "bg-green/10 border-green/30 text-green" :
                                isError ? "bg-red-500/10 border-red-500/30 text-red-400" :
                                    "bg-surface2 border-border text-text-secondary"
                                }`}>
                                {/* Status row */}
                                <div className="flex items-center gap-3 pb-4 border-b border-current/20">
                                    {isDone && <CheckCircle2 className="w-6 h-6 shrink-0" />}
                                    {isError && <AlertCircle className="w-6 h-6 shrink-0" />}
                                    {isProcessing && (
                                        <Loader2 className="w-6 h-6 shrink-0 animate-spin text-orange-400" />
                                    )}
                                    <h3 className="font-bold text-lg">{statusLabel[job.status]}</h3>
                                </div>

                                {/* Error message */}
                                {isError && job.errorMessage && (
                                    <p className="text-sm opacity-80">{job.errorMessage}</p>
                                )}

                                {/* Counters grid */}
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    {[
                                        { icon: <BarChart3 size={16} />, value: job.rowsProcessed, label: "Rows Processed" },
                                        { icon: <BarChart3 size={16} />, value: job.incidentsAdded, label: "Incidents Added" },
                                        { icon: <BarChart3 size={16} />, value: job.suburbsAdded, label: "Suburbs Added" },
                                    ].map(({ icon, value, label }) => (
                                        <div key={label} className="bg-surface rounded-lg p-3 border border-current/20">
                                            <div className="text-2xl font-black text-text-primary tabular-nums">
                                                {value.toLocaleString()}
                                            </div>
                                            <div className="text-xs uppercase tracking-widest font-semibold mt-1 flex items-center justify-center gap-1 opacity-80">
                                                {icon} {label}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Live pulse when running */}
                                {isProcessing && (
                                    <p className="text-xs text-center opacity-60">
                                        <Clock className="inline w-3 h-3 mr-1" />
                                        Refreshing every 2 s — you can leave this page safely
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Upload button */}
                        <button
                            type="submit"
                            disabled={!file || uploading || !!isProcessing}
                            className="btn-primary w-full relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg py-4 rounded-xl shadow-lg transition-all duration-300 transform"
                        >
                            <div className="relative z-10 flex items-center justify-center gap-2">
                                {uploading ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Upload size={20} />
                                        {isProcessing ? "Processing…" : "Upload Data"}
                                    </>
                                )}
                            </div>
                        </button>
                    </form>
                </div>

                {/* ── Clear Imported Data ─────────────────────────────────── */}
                <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl overflow-hidden relative mt-6">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-900 via-red-700 to-red-500" />

                    <h2 className="text-2xl font-bold text-text-primary mb-2 flex items-center gap-3">
                        <Trash2 className="text-red-500" size={28} />
                        Clear Imported Data
                    </h2>
                    <p className="text-text-secondary text-sm mb-6">
                        Removes all SAPS-imported incidents and their suburbs. Seeded demo data is not affected.
                        Use this before re-importing to avoid duplicates.
                    </p>

                    {clearMsg && (
                        <div className={`mb-4 p-4 rounded-xl border text-sm flex items-start gap-3 ${clearMsg.startsWith("Error") ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-green/10 border-green/30 text-green"}`}>
                            {clearMsg.startsWith("Error") ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                            {clearMsg}
                        </div>
                    )}

                    <button
                        onClick={handleClear}
                        disabled={clearing}
                        className="w-full py-3 rounded-xl font-bold text-base border border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {clearing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 size={18} />}
                        {clearing ? "Clearing…" : "Clear All Imported Data"}
                    </button>
                </div>
            </div>
        </div>
    );
}