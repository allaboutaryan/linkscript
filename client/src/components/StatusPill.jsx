export default function StatusPill({ status }) {
  const isConnected = status === "connected";

  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
        isConnected
          ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
          : "border-red-300/25 bg-red-300/10 text-red-200"
      ].join(" ")}
    >
      <span
        className={[
          "h-2 w-2 rounded-full",
          isConnected ? "bg-emerald-300" : "bg-red-300"
        ].join(" ")}
      />
      {isConnected ? "Connected" : "Disconnected"}
    </div>
  );
}

