"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Clock, Loader2, BarChart3 } from "lucide-react";

type JobStatus = "QUEUED" | "RUNNING" | "DONE" | "ERROR";

interface ImportJob {
    jobId: string;
    status: JobStatus;
    rowsProcessed: number;
    incidentsAdded: number;
    suburbsAdded: number;
    errorMessage: string | null;
}

export default function AdminPage() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [job, setJob] = useState<ImportJob | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const baseUrl = process.env.NEXT_PUBLIC_JAVA_API_URL || "http://localhost:8080";

    // ── Polling ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!job || job.status === "DONE" || job.status === "ERROR") {
            if (pollRef.current) clearInterval(pollRef.current);
            return;
        }

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${baseUrl}/api/admin/upload/status/${job.jobId}`);
                if (res.ok) {
                    const updated: ImportJob = await res.json();
                    setJob(updated);
                }
            } catch {
                // Network blip — keep polling
            }
        }, 2000);

        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [job?.jobId, job?.status]);

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setJob(null);
            setError(null);
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
                body: formData,
            });

            if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);

            // 202 Accepted — server returns { jobId }
            const { jobId } = await res.json();
            setJob({
                jobId,
                status: "QUEUED",
                rowsProcessed: 0,
                incidentsAdded: 0,
                suburbsAdded: 0,
                errorMessage: null,
            });
        } catch (err: any) {
            setError(err.message || "An error occurred during upload");
        } finally {
            setUploading(false);
        }
    };

    // ── Status helpers ─────────────────────────────────────────────────────
    const statusLabel: Record<JobStatus, string> = {
        QUEUED:  "Queued — waiting for worker…",
        RUNNING: "Processing rows…",
        DONE:    "Import Complete",
        ERROR:   "Import Failed",
    };

    const isProcessing = job && (job.status === "QUEUED" || job.status === "RUNNING");
    const isDone       = job?.status === "DONE";
    const isError      = job?.status === "ERROR";

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
                            className={`border-2 border-dashed rounded-xl p-10 transition-all duration-300 text-center flex flex-col items-center justify-center gap-4 relative ${
                                file ? "border-red-500/50 bg-red-500/5" : "border-border bg-surface2 hover:border-text-secondary"
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
                            <div className={`rounded-xl border p-6 flex flex-col gap-4 transition-all duration-500 ${
                                isDone  ? "bg-green/10 border-green/30 text-green" :
                                isError ? "bg-red-500/10 border-red-500/30 text-red-400" :
                                          "bg-surface2 border-border text-text-secondary"
                            }`}>
                                {/* Status row */}
                                <div className="flex items-center gap-3 pb-4 border-b border-current/20">
                                    {isDone  && <CheckCircle2 className="w-6 h-6 shrink-0" />}
                                    {isError && <AlertCircle  className="w-6 h-6 shrink-0" />}
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
                                        { icon: <BarChart3 size={16} />, value: job.suburbsAdded,   label: "Suburbs Added"  },
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
            </div>
        </div>
    );
}
