"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { formatDateTime, formatDate } from "@/lib/format";
import { useTrack } from "@/components/TrackingProvider";

type StreamDetail = {
  id: string;
  title: string;
  status: "IDLE" | "LIVE" | "ENDED" | "ARCHIVED";
  visibility: "MEMBERS_ONLY" | "PUBLIC";
  streamKey: string;
  rink: { name: string; green: { name: string } };
  event: { id: string; title: string } | null;
  viewerCount: number;
  startedAt: string | null;
  endedAt: string | null;
};

type StreamToken = {
  id: string;
  token: string;
  expiresAt: string;
  maxUses: number | null;
  useCount: number;
};

type StreamMetrics = {
  currentViewers: number;
  totalViewers: number;
  uniqueViewers: number;
  avgDurationSeconds: number;
  peakConcurrent: number;
};

export default function StreamControlPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const { trackFeature } = useTrack();
  const [stream, setStream] = useState<StreamDetail | null>(null);
  const [tokens, setTokens] = useState<StreamToken[]>([]);
  const [metrics, setMetrics] = useState<StreamMetrics | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [actionError, setActionError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => { trackFeature("streaming", "broadcast_view"); }, [trackFeature, id]);

  useEffect(() => {
    fetchStream();
    fetchTokens();
    fetchMetrics();
    const interval = setInterval(() => {
      fetchStream();
      fetchMetrics();
    }, 5000);
    return () => clearInterval(interval);
  }, [id]);

  async function fetchStream() {
    const res = await fetch(`/api/streaming/${id}`);
    if (res.ok) setStream(await res.json());
  }

  async function fetchTokens() {
    const res = await fetch(`/api/streaming/${id}/tokens`);
    if (res.ok) setTokens(await res.json());
  }

  async function fetchMetrics() {
    const res = await fetch(`/api/streaming/${id}/metrics`);
    if (res.ok) setMetrics(await res.json());
  }

  async function startBroadcast() {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setBroadcasting(true);

      // Start the stream on server
      const res = await fetch(`/api/streaming/${id}/start`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d.error ?? `Failed to start stream (${res.status})`);
        setBroadcasting(false);
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        return;
      }
      setActionError("");
      fetchStream();
    } catch (err) {
      setActionError("Could not access camera/microphone. Please grant permissions.");
    }
  }

  async function stopBroadcast() {
    if (!confirm("Stop broadcasting?")) return;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setBroadcasting(false);

    const res = await fetch(`/api/streaming/${id}/stop`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setActionError(d.error ?? `Failed to stop stream (${res.status})`);
      return;
    }
    setActionError("");
    fetchStream();
  }

  async function generateToken() {
    const res = await fetch(`/api/streaming/${id}/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInHours: 24 }),
    });
    if (res.ok) { setActionError(""); fetchTokens(); return; }
    const d = await res.json().catch(() => ({}));
    setActionError(d.error ?? `Failed to generate token (${res.status})`);
  }

  async function revokeToken(tokenId: string) {
    const res = await fetch(`/api/streaming/${id}/tokens/${tokenId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setActionError(d.error ?? `Failed to revoke token (${res.status})`);
      return;
    }
    setActionError("");
    fetchTokens();
  }

  function copyWatchUrl(token?: string) {
    const base = `${window.location.origin}/${stream?.id}`;
    const url = token
      ? `${window.location.origin}/api/streaming/${id}/watch?token=${token}`
      : `${window.location.origin}/api/streaming/${id}/watch`;
    navigator.clipboard.writeText(url);
    alert("Watch URL copied!");
  }

  if (!stream) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {actionError && (
        <div className="rounded bg-red-100 text-red-800 px-4 py-2 flex items-center justify-between" role="alert">
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="text-red-700 hover:text-red-900 text-sm">Dismiss</button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{stream.title}</h1>
          <p className="text-gray-600">{stream.rink.green.name} — {stream.rink.name}</p>
        </div>
        <span className={`px-3 py-1 rounded text-sm font-medium ${
          stream.status === "LIVE" ? "bg-red-500 text-white animate-pulse" : "bg-gray-200"
        }`}>
          {stream.status}
        </span>
      </div>

      {/* Broadcast Controls */}
      <section className="border rounded p-4">
        <h2 className="font-semibold mb-3">Broadcast</h2>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full max-h-64 bg-black rounded mb-3"
          style={{ display: broadcasting ? "block" : "none" }}
        />
        {stream.status === "IDLE" && !broadcasting && (
          <button onClick={startBroadcast} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
            Start Broadcasting
          </button>
        )}
        {broadcasting && stream.status === "LIVE" && (
          <div className="flex items-center gap-4">
            <span className="text-red-500 font-medium">● LIVE — {stream.viewerCount} watching</span>
            <button onClick={stopBroadcast} className="bg-gray-700 text-white px-4 py-2 rounded">
              Stop
            </button>
          </div>
        )}
        {stream.status === "ENDED" && (
          <p className="text-gray-500">Stream ended {stream.endedAt && formatDateTime(stream.endedAt, locale)}</p>
        )}
      </section>

      {/* Metrics */}
      {metrics && (
        <section className="border rounded p-4">
          <h2 className="font-semibold mb-3">Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{metrics.currentViewers}</p>
              <p className="text-xs text-gray-500">Current Viewers</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.totalViewers}</p>
              <p className="text-xs text-gray-500">Total Viewers</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.uniqueViewers}</p>
              <p className="text-xs text-gray-500">Unique Viewers</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{Math.round(metrics.avgDurationSeconds / 60)}m</p>
              <p className="text-xs text-gray-500">Avg Watch Time</p>
            </div>
          </div>
        </section>
      )}

      {/* Share Tokens */}
      <section className="border rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Share Tokens</h2>
          <button onClick={generateToken} className="text-blue-600 text-sm hover:underline">
            + Generate Token
          </button>
        </div>
        {tokens.length === 0 ? (
          <p className="text-sm text-gray-500">No tokens generated yet.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                <div>
                  <code className="text-xs">{t.token.slice(0, 12)}...</code>
                  <span className="ml-2 text-gray-500">
                    Expires: {formatDate(t.expiresAt, locale)}
                    {t.maxUses && ` • ${t.useCount}/${t.maxUses} uses`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyWatchUrl(t.token)} className="text-blue-600 hover:underline">
                    Copy URL
                  </button>
                  <button onClick={() => revokeToken(t.id)} className="text-red-500 hover:underline">
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Stream Info */}
      <section className="border rounded p-4 text-sm text-gray-600">
        <h2 className="font-semibold text-gray-800 mb-2">Stream Details</h2>
        <p><strong>Stream Key:</strong> <code>{stream.streamKey}</code></p>
        <p><strong>Visibility:</strong> {stream.visibility}</p>
        <p><strong>RTMP URL:</strong> <code>rtmp://localhost:1935/live/{stream.streamKey}</code></p>
      </section>
    </div>
  );
}
