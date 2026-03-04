"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";

export default function AdminPage() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{
        rowsProcessed: number;
        incidentsAdded: number;
        suburbsAdded: number;
    } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setResult(null);
            setError(null);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setLoading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const baseUrl = process.env.NEXT_PUBLIC_JAVA_API_URL || "http://localhost:8080";
            const res = await fetch(`${baseUrl}/api/admin/upload`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                throw new Error(`Upload failed with status ${res.status}`);
            }

            const data = await res.json();
            setResult(data);
        } catch (err: any) {
            setError(err.message || "An error occurred during upload");
        } finally {
            setLoading(false);
        }
    };

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
                        <div
                            className={`border-2 border-dashed rounded-xl p-10 transition-all duration-300 text-center flex flex-col items-center justify-center gap-4 ${file ? 'border-red-500/50 bg-red-500/5' : 'border-border bg-surface2 hover:border-text-secondary'
                                }`}
                        >
                            <Upload className={`w-12 h-12 mb-2 ${file ? 'text-red-400' : 'text-text-dim'}`} />
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

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <p>{error}</p>
                            </div>
                        )}

                        {result && (
                            <div className="bg-green/10 border border-green/30 text-green p-6 rounded-xl flex flex-col gap-4">
                                <div className="flex items-center gap-3 border-b border-green/20 pb-4">
                                    <CheckCircle2 className="w-6 h-6 shrink-0" />
                                    <h3 className="font-bold text-lg">Upload Successful</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="bg-surface2 rounded-lg p-3 border border-green/20">
                                        <div className="text-2xl font-black text-text-primary">{result.rowsProcessed}</div>
                                        <div className="text-sm text-green/80 uppercase tracking-widest font-semibold mt-1">Rows Processed</div>
                                    </div>
                                    <div className="bg-surface2 rounded-lg p-3 border border-green/20">
                                        <div className="text-2xl font-black text-text-primary">{result.incidentsAdded}</div>
                                        <div className="text-sm text-green/80 uppercase tracking-widest font-semibold mt-1">Incidents Added</div>
                                    </div>
                                    <div className="bg-surface2 rounded-lg p-3 border border-green/20">
                                        <div className="text-2xl font-black text-text-primary">{result.suburbsAdded}</div>
                                        <div className="text-sm text-green/80 uppercase tracking-widest font-semibold mt-1">Suburbs Added</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!file || loading}
                            className="btn-primary w-full relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg py-4 rounded-xl shadow-lg transition-all duration-300 transform"
                        >
                            <div className="relative z-10 flex items-center justify-center gap-2">
                                {loading ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Upload size={20} />
                                        Upload Data
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
