export default function TypingIndicator({ users }) {
  if (!users.length) {
    return <div className="h-6" aria-live="polite" />;
  }

  const names = users.map((user) => user.name);
  const message =
    names.length === 1
      ? `${names[0]} is typing...`
      : `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""} are typing...`;

  return (
    <div className="flex h-6 items-center gap-2 text-sm text-zinc-400" aria-live="polite">
      <div className="flex -space-x-1">
        {users.slice(0, 3).map((user) => (
          <span
            key={user.id}
            className="h-2.5 w-2.5 rounded-full ring-2 ring-zinc-950"
            style={{ backgroundColor: user.color }}
          />
        ))}
      </div>
      <span>{message}</span>
    </div>
  );
}

