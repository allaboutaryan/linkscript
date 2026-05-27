import { useState } from "react";
import StatusPill from "../components/StatusPill.jsx";

export default function HomePage({ state, onCreateSession, onJoinSession }) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("room") || "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4);
  });
  const hasName = name.trim().length > 0;
  const cleanRoomCode = roomCode.trim().toUpperCase();
  const canCreate = hasName && !state.isBusy;
  const canJoin = hasName && cleanRoomCode.length > 0 && !state.isBusy;

  function handleSubmit(event) {
    event.preventDefault();

    if (!canJoin) {
      return;
    }

    onJoinSession(cleanRoomCode, name);
  }

  function handleCreateSession() {
    if (!canCreate) {
      return;
    }

    onCreateSession(name);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-lg font-semibold text-cyan-200">
              L
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-normal">LinkPad</h1>
              <p className="text-sm text-zinc-400">Local realtime notes</p>
            </div>
          </div>
          <StatusPill status={state.connectionStatus} />
        </header>

        <div className="flex flex-1 items-center py-12">
          <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="max-w-2xl">
              <p className="mb-4 text-sm font-medium uppercase text-cyan-200">
                Same WiFi. Shared note. No sign-in.
              </p>
              <h2 className="text-4xl font-semibold tracking-normal text-white sm:text-6xl">
                Start a live note in seconds.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-300">
                Create a room, share the code, and everyone nearby can type together instantly over the local network.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-cyan-950/20">
              <div className="mb-4 space-y-2">
                <label className="block text-sm font-medium text-zinc-300" htmlFor="name">
                  Your name
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={24}
                  placeholder="Arya"
                  className="h-12 w-full rounded-md border border-zinc-700 bg-zinc-950 px-4 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-cyan-300"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateSession}
                disabled={!canCreate}
                className="h-12 w-full rounded-md bg-cyan-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {state.isBusy ? "Please wait..." : "Create Session"}
              </button>

              <div className="my-5 flex items-center gap-3 text-xs uppercase text-zinc-500">
                <div className="h-px flex-1 bg-zinc-800" />
                or join
                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block text-sm font-medium text-zinc-300" htmlFor="roomCode">
                  Room code
                </label>
                <input
                  id="roomCode"
                  value={roomCode}
                  onChange={(event) =>
                    setRoomCode(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())
                  }
                  maxLength={4}
                  placeholder="X7K2"
                  className="h-12 w-full rounded-md border border-zinc-700 bg-zinc-950 px-4 text-center text-xl font-semibold uppercase tracking-[0.25em] text-white outline-none transition placeholder:text-zinc-700 focus:border-cyan-300"
                />
                <button
                  type="submit"
                  disabled={!canJoin}
                  className="h-12 w-full rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition hover:border-cyan-300 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {state.isBusy ? "Joining..." : "Join Session"}
                </button>
              </form>

              {state.error ? (
                <p className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100">
                  {state.error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
