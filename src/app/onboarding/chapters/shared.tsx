import type { Progress } from "../page";

export type ChapterProps = {
  tenantId: string | null;
  progress: Progress;
  onAdvance: () => void | Promise<void>;
  onGoTo: (chapter: number) => void;
  reload: () => Promise<void>;
};

export function ChapterShell({
  title,
  intro,
  children,
  onSubmit,
  submitLabel = "Save and continue",
  busy = false,
  canSkip = false,
  onSkip,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  submitLabel?: string;
  busy?: boolean;
  canSkip?: boolean;
  onSkip?: () => void;
}) {
  return (
    <form
      onSubmit={onSubmit ?? ((e) => e.preventDefault())}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6"
    >
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
        {intro && <p className="mt-2 text-gray-600">{intro}</p>}
      </div>
      <div className="space-y-4">{children}</div>
      {onSubmit && (
        <div className="pt-4 border-t flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : submitLabel}
          </button>
          {canSkip && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="px-5 py-2 rounded-md text-gray-600 hover:text-gray-900"
            >
              Skip for now
            </button>
          )}
        </div>
      )}
    </form>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-800">{label}</span>
      {hint && <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";
