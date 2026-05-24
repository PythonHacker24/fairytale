"use client";

import { createContext, useContext, useEffect, useState } from "react";
import AssetsSidebar from "./AssetsSidebar";
import ViewsSidebar from "./ViewsSidebar";

const LEFT_KEY = "left-sidebar-open";
const RIGHT_KEY = "right-sidebar-open";

const LEFT_OPEN_W = 288;  // w-72
const LEFT_COLLAPSED_W = 40;
const RIGHT_OPEN_W = 240; // w-60
const RIGHT_COLLAPSED_W = 40;

type Ctx = {
  leftOpen: boolean;
  setLeftOpen: (v: boolean) => void;
  rightOpen: boolean;
  setRightOpen: (v: boolean) => void;
};
const ShellCtx = createContext<Ctx>({
  leftOpen: true,
  setLeftOpen: () => {},
  rightOpen: true,
  setRightOpen: () => {},
});

export function useShell() {
  return useContext(ShellCtx);
}

export default function SidebarShell({ children }: { children: React.ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  useEffect(() => {
    const l = localStorage.getItem(LEFT_KEY);
    const r = localStorage.getItem(RIGHT_KEY);
    if (l !== null) setLeftOpen(l === "1");
    if (r !== null) setRightOpen(r === "1");
  }, []);
  useEffect(() => localStorage.setItem(LEFT_KEY, leftOpen ? "1" : "0"), [leftOpen]);
  useEffect(() => localStorage.setItem(RIGHT_KEY, rightOpen ? "1" : "0"), [rightOpen]);

  const leftW = leftOpen ? LEFT_OPEN_W : LEFT_COLLAPSED_W;
  const rightW = rightOpen ? RIGHT_OPEN_W : RIGHT_COLLAPSED_W;

  return (
    <ShellCtx.Provider value={{ leftOpen, setLeftOpen, rightOpen, setRightOpen }}>
      <div className="min-h-screen">
        <AssetsSidebar />
        <ViewsSidebar />
        <main
          className="transition-[margin] duration-200"
          style={{ marginLeft: leftW, marginRight: rightW }}
        >
          {children}
        </main>
      </div>
    </ShellCtx.Provider>
  );
}
