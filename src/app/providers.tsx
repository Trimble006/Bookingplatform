"use client";

import { SessionProvider } from "next-auth/react";
import TrackingProvider from "@/components/TrackingProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TrackingProvider>{children}</TrackingProvider>
    </SessionProvider>
  );
}
