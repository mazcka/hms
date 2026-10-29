"use client";

import { useEffect } from "react";
import { savePushSubscription } from "@/lib/push-client";

export function PushSync({ accessToken }: { accessToken: string }) {
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    savePushSubscription(accessToken).catch(() => {});
  }, [accessToken]);
  return null;
}
