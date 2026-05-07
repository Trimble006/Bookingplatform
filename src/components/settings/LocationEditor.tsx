"use client";

import { useEffect, useState } from "react";

type Props = {
  tenantId: string;
  /** Called after a successful save. */
  onSaved?: () => void | Promise<void>;
  /** Optional skip handler — used by the onboarding wizard. */
  onSkip?: () => void | Promise<void>;
  /** Submit button label. Defaults to "Save". */
  submitLabel?: string;
  /** Wrap the form in the onboarding chrome (title + intro). When false, render bare. */
  variant?: "onboarding" | "settings";
  /** Title shown in onboarding variant. Ignored in settings variant. */
  title?: string;
  /** Intro shown in onboarding variant. Ignored in settings variant. */
  intro?: string;
};

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

/**
 * Tenant lat/lng editor. Powers both the onboarding "where you are" chapter
 * and the post-onboarding `/dashboard/settings/location` page. Talks to
 * `PATCH /api/admin/tenants/:id` (which gates on effective TENANT_ADMIN).
 */
export default function LocationEditor({
  tenantId,
  onSaved,
  onSkip,
  submitLabel = "Save",
  variant = "settings",
  title,
  intro,
}: Props) {
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/admin/tenants/${tenantId}`)
      .then((r) => r.json())
      .then((t) => {
        setLatitude(t.latitude != null ? String(t.latitude) : "");
        setLongitude(t.longitude != null ? String(t.longitude) : "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [tenantId]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Your browser does not support location lookup.");
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
      },
      () => setGeoError("Could not get your location. Enter manually below."),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setBusy(true);
    setSavedMsg(null);
    const lat = latitude ? Number(latitude) : null;
    const lng = longitude ? Number(longitude) : null;
    const res = await fetch(`/api/admin/tenants/${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    });
    setBusy(false);
    if (res.ok) {
      setGeoError(null); // Clear geo error on successful manual save.
      setSavedMsg("Location saved.");
      if (onSaved) await onSaved();
    } else {
      setSavedMsg("Save failed. Check the values and try again.");
    }
  };

  if (!loaded) return <div className="text-gray-500">Loading…</div>;

  const isOnboarding = variant === "onboarding";

  const fields = (
    <div className="space-y-4">
      <button
        type="button"
        onClick={useMyLocation}
        className="px-4 py-2 rounded-md border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
      >
        Use my current location
      </button>
      {geoError && <p className="text-sm text-red-600">{geoError}</p>}
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="block font-medium text-gray-700">Latitude</span>
          <span className="block text-xs text-gray-500 mb-1">Between -90 and 90</span>
          <input
            className={inputCls}
            value={latitude}
            onChange={(e) => {
              setLatitude(e.target.value);
              setSavedMsg(null);
            }}
            placeholder="55.953"
            inputMode="decimal"
          />
        </label>
        <label className="block text-sm">
          <span className="block font-medium text-gray-700">Longitude</span>
          <span className="block text-xs text-gray-500 mb-1">Between -180 and 180</span>
          <input
            className={inputCls}
            value={longitude}
            onChange={(e) => {
              setLongitude(e.target.value);
              setSavedMsg(null);
            }}
            placeholder="-3.188"
            inputMode="decimal"
          />
        </label>
      </div>
      {latitude && longitude && (
        <p className="text-xs text-gray-500">
          Coordinates set: {latitude}, {longitude}.
        </p>
      )}
      {savedMsg && (
        <p className={`text-sm ${savedMsg.startsWith("Save failed") ? "text-red-600" : "text-emerald-700"}`}>
          {savedMsg}
        </p>
      )}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        {onSkip && (
          <button
            type="button"
            onClick={() => onSkip()}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );

  if (isOnboarding) {
    return (
      <form onSubmit={submit} className="space-y-6">
        {title && <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>}
        {intro && <p className="text-gray-600">{intro}</p>}
        {fields}
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border bg-white p-6 max-w-2xl">
      {fields}
    </form>
  );
}
