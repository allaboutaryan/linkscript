export default function ParticipantDots({ users }) {
  if (!users.length) {
    return null;
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      {users.map((user) => (
        <div
          key={user.id}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
          title={user.name}
        >
          <span
            className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]"
            style={{ backgroundColor: user.color, color: user.color }}
          />
          <span className="max-w-24 truncate">{user.name}</span>
        </div>
      ))}
    </div>
  );
}

