"use client";

import React from "react";
import { TopographyBackground } from "@/components/ui/backgrounds-topography";

export default function TopographyBackgroundDemo() {
  return (
    <div className="relative h-screen w-full overflow-hidden">
      <TopographyBackground className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#fafafa_0%,#f0f0f0_100%)] text-neutral-500 dark:bg-[radial-gradient(ellipse_at_center,#171717_0%,#000_100%)] dark:text-neutral-400" />
    </div>
  );
}
