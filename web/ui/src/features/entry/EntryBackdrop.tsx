import React from "react";
import "./entry.css";

interface EntryBackdropProps {
  children: React.ReactNode;
}

export function EntryBackdrop({ children }: EntryBackdropProps) {
  return (
    <div className="entry-backdrop">
      <div className="entry-backdrop__overlay" />
      <div className="entry-backdrop__content">{children}</div>
    </div>
  );
}
