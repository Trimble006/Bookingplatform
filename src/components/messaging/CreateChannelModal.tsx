"use client";

import { useState } from "react";

type ChannelType = "PUBLIC" | "PRIVATE" | "GROUP";

export default function CreateChannelModal({
  onClose,
  onCreate,
  tenantUsers,
}: {
  onClose: () => void;
  onCreate: (data: { name: string; type: ChannelType; description?: string; memberIds: string[] }) => void;
  tenantUsers: { id: string; name: string | null; email: string }[];
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>("PUBLIC");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), type, description: description.trim() || undefined, memberIds: selectedMembers });
  }

  function toggleMember(userId: string) {
    setSelectedMembers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="font-bold text-lg mb-4">Create Channel</h3>

        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="general"
          required
        />

        <label className="block text-sm font-medium mb-1">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value as ChannelType)} className="w-full border rounded px-3 py-2 mb-3">
          <option value="PUBLIC">Public — anyone can join</option>
          <option value="PRIVATE">Private — invite only</option>
          <option value="GROUP">Group — invite only, named group</option>
        </select>

        <label className="block text-sm font-medium mb-1">Description (optional)</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="What's this channel about?"
        />

        {type !== "PUBLIC" && (
          <>
            <label className="block text-sm font-medium mb-1">Add Members</label>
            <div className="max-h-40 overflow-y-auto border rounded p-2 mb-3">
              {tenantUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 px-1 rounded">
                  <input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={() => toggleMember(u.id)} />
                  <span className="text-sm">{u.name ?? u.email}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded border hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
