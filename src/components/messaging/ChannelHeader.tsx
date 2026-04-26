"use client";

type Member = {
  userId: string;
  role: string;
  mutedUntil?: string | null;
  user: { id: string; name: string | null; email: string };
};

export default function ChannelHeader({
  channelName,
  channelType,
  members,
  isAdmin,
  onManageMembers,
}: {
  channelName: string;
  channelType: string;
  members: Member[];
  isAdmin: boolean;
  onManageMembers?: () => void;
}) {
  const typeLabel: Record<string, string> = { PUBLIC: "Public Channel", PRIVATE: "Private Channel", GROUP: "Group", DIRECT: "Direct Message" };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
      <div>
        <h2 className="font-bold text-lg">{channelName}</h2>
        <span className="text-xs text-gray-500">
          {typeLabel[channelType] ?? channelType} · {members.length} member{members.length !== 1 ? "s" : ""}
        </span>
      </div>
      {isAdmin && channelType !== "DIRECT" && onManageMembers && (
        <button onClick={onManageMembers} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded">
          Manage Members
        </button>
      )}
    </div>
  );
}
