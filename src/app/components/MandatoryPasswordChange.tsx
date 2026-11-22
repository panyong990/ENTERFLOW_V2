import { useState } from "react";
import { api } from "../api/client";

export function MandatoryPasswordChange({ onComplete }: { onComplete: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (!currentPassword || currentPassword.length > 1024) {
      setError("Enter your current password.");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 1024) {
      setError("New password must contain 8 to 1024 characters.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("Your new password must differ from your current password.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword }
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Password change failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Change your password</h1>
        <p className="mt-2 mb-6 text-sm text-slate-600">
          You must change your initial password before accessing your Enter-Flow workspace.
        </p>

        <label className="mb-1 block text-sm font-medium">Current password</label>
        <input type="password" autoComplete="current-password" required value={currentPassword}
          onChange={event => setCurrentPassword(event.target.value)}
          className="mb-4 w-full rounded-md border px-3 py-2" />

        <label className="mb-1 block text-sm font-medium">New password</label>
        <input type="password" autoComplete="new-password" required minLength={8} value={newPassword}
          onChange={event => setNewPassword(event.target.value)}
          className="mb-4 w-full rounded-md border px-3 py-2" />

        <label className="mb-1 block text-sm font-medium">Confirm new password</label>
        <input type="password" autoComplete="new-password" required value={confirmation}
          onChange={event => setConfirmation(event.target.value)}
          className="mb-4 w-full rounded-md border px-3 py-2" />

        {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}

        <button type="submit" disabled={busy}
          className="w-full rounded-md bg-[#C8102E] px-4 py-3 font-semibold text-white disabled:opacity-50">
          {busy ? "Updating password..." : "Update password"}
        </button>
      </form>
    </main>
  );
}