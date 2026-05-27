import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

export default function InvitePanel({ roomCode }) {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [qrCode, setQrCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/network")
      .then((response) => response.json())
      .then((data) => {
        if (isMounted) {
          setNetworkInfo(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setNetworkInfo(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const inviteUrl = useMemo(() => {
    const preferredBaseUrl = networkInfo?.lanUrls?.[0] || window.location.origin;
    return `${preferredBaseUrl}?room=${roomCode}`;
  }, [networkInfo, roomCode]);

  useEffect(() => {
    QRCode.toDataURL(inviteUrl, {
      margin: 1,
      width: 180,
      color: {
        dark: "#09090b",
        light: "#ffffff"
      }
    })
      .then(setQrCode)
      .catch(() => setQrCode(""));
  }, [inviteUrl]);

  async function copyInviteLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="mb-4 grid gap-4 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p className="text-xs font-medium uppercase text-cyan-200">Room Code</p>
        <p className="mt-1 text-3xl font-semibold tracking-[0.25em] text-white">{roomCode}</p>
        <p className="mt-3 break-all text-sm text-zinc-300">{inviteUrl}</p>
        <button
          type="button"
          onClick={copyInviteLink}
          className="mt-3 h-11 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
        >
          {copied ? "Copied" : "Copy Phone Invite Link"}
        </button>
      </div>
      {qrCode ? (
        <img
          src={qrCode}
          alt="Phone invite QR code"
          className="h-36 w-36 rounded-md bg-white p-2"
        />
      ) : null}
    </div>
  );
}

