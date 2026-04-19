"use client";

import type { ReactNode } from "react";

interface AppHeaderProps {
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  children?: ReactNode;
  hideTitle?: boolean;
}

export function AppHeader({
  leftContent,
  rightContent,
  children,
  hideTitle = false,
}: AppHeaderProps) {
  return (
    <header className="relative flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <div className="flex min-w-0 items-center gap-3">{leftContent}</div>

      {!hideTitle ? (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[0.9375rem] font-semibold tracking-[-0.04em] text-foreground">
          ContextKings
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {children}
        {rightContent}
      </div>
    </header>
  );
}
