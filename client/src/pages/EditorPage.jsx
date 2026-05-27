import { useState } from "react";
import InvitePanel from "../components/InvitePanel.jsx";
import ParticipantDots from "../components/ParticipantDots.jsx";
import StatusPill from "../components/StatusPill.jsx";
import TypingIndicator from "../components/TypingIndicator.jsx";

export default function EditorPage({ state, onNoteChange, onImagesAdd, onImageRemove, onLeaveRoom }) {
  const [copied, setCopied] = useState(false);

  async function copyRoomCode() {
    await navigator.clipboard.writeText(state.roomCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function handlePaste(event) {
    const files = Array.from(event.clipboardData?.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length) {
      event.preventDefault();
      onImagesAdd(imageFiles);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  function handleDrop(event) {
    event.preventDefault();
    onImagesAdd(event.dataTransfer?.files || []);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-4 sm:px-6">
        <header className="flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-lg font-semibold text-cyan-200">
              L
            </div>
            <div>
              <h1 className="text-lg font-semibold">LinkPad</h1>
              <p className="text-sm text-zinc-400">Room {state.roomCode}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={state.connectionStatus} />
            <ParticipantDots users={state.users} />
            <div className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
              {state.usersCount} online
            </div>
            <button
              type="button"
              onClick={copyRoomCode}
              className="rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-cyan-300 hover:text-cyan-100"
            >
              {copied ? "Copied" : "Copy Code"}
            </button>
            <button
              type="button"
              onClick={onLeaveRoom}
              className="rounded-md border border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-100"
            >
              Leave
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col py-4">
          <InvitePanel roomCode={state.roomCode} />
          <TypingIndicator users={state.typingUsers} />
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="mb-3 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-3 text-sm text-zinc-400 transition hover:border-cyan-300/60"
          >
            Paste or drag photos here to share them with the room.
          </div>
          {state.images.length ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {state.images.map((image) => (
                <figure
                  key={image.id}
                  className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
                >
                  <img
                    src={image.dataUrl}
                    alt={image.name}
                    className="h-44 w-full object-cover"
                  />
                  <figcaption className="flex items-center justify-between gap-3 p-3 text-sm text-zinc-300">
                    <span className="truncate" title={image.name}>
                      {image.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => onImageRemove(image.id)}
                      className="shrink-0 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:border-red-300 hover:text-red-100"
                    >
                      Remove
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          <textarea
            value={state.note}
            onChange={(event) => onNoteChange(event.target.value)}
            onPaste={handlePaste}
            spellCheck="true"
            placeholder="Start typing, paste a photo, or drag images above. Everyone in this room will see updates live..."
            className="min-h-[70vh] flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-900/80 p-5 text-base leading-7 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-300 sm:text-lg"
          />
        </div>
      </section>
    </main>
  );
}
