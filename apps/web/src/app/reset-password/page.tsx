import { Suspense } from "react";

import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = { title: "Reset password — Community Alerts" };

// useSearchParams requires a Suspense boundary during static prerender.
export default function ResetPasswordPage() {
  return (
    <main className="standalone-page">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
