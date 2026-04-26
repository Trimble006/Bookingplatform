"use client";

import { useState } from "react";

export default function MessageInput({
  onSend,
  disabled,
  mutedUntil,
}: {
  onSend: (body: string) => void;
  disabled?: boolean;
  mutedUntil?: string | null;
}) {
  const [text, setText] = useState("");

  const isMuted = mutedUntil && new Date(mutedUntil) > new Date();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t">
      {isMuted ? (
        <div className="flex-1 text-center text-sm text-gray-500 py-2">
          You are muted until {new Date(mutedUntil!).toLocaleString()}
        </div>
      ) : (
        <>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            maxLength={2000}
            disabled={disabled}
            className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            Send
          </button>
        </>
      )}
    </form>
  );
}
