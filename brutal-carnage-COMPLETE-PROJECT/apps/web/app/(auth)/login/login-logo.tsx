// app/(auth)/login/login-logo.tsx
// Small client component so the login page (a server component) can
// still gracefully fall back if /logo.png ever fails to load, instead
// of just showing a broken image icon.
"use client";

import Image from "next/image";
import { useState } from "react";

export function LoginLogo() {
  const [failed, setFailed] = useState(false);

  return (
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-red-800/60 bg-red-950/40">
      {failed ? (
        <span className="font-display text-lg tracking-wide text-red-300">BC</span>
      ) : (
        <Image
          src="/logo.png"
          alt="Brutal Carnage"
          width={64}
          height={64}
          priority
          unoptimized
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
