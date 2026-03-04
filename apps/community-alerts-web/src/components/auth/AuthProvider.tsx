"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface AuthUser {
    username: string;
    role: string;
    token: string;
}

interface AuthContextValue {
    user: AuthUser | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    isAuthenticated: false,
    login: async () => { },
    logout: () => { },
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);

    // Hydrate from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem("auth_user");
            if (stored) {
                const parsed = JSON.parse(stored) as AuthUser;
                if (parsed.token) setUser(parsed);
            }
        } catch {
            localStorage.removeItem("auth_user");
        }
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        const baseUrl = process.env.NEXT_PUBLIC_JAVA_API_URL || "http://localhost:8080";
        const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "Login failed");
        }

        const data = await res.json();
        const authUser: AuthUser = {
            username: data.username,
            role: data.role,
            token: data.token,
        };

        localStorage.setItem("auth_user", JSON.stringify(authUser));
        document.cookie = `auth_token=${authUser.token}; path=/; max-age=86400; SameSite=Lax`;
        setUser(authUser);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem("auth_user");
        document.cookie = "auth_token=; path=/; max-age=0";
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
