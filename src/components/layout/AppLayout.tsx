// ============================================================
// WMDM Desktop App — Main App Layout
// Sidebar + Content area
// ============================================================

import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TitleBar from "./TitleBar";
import MiniPlayer from "../audio/MiniPlayer";

export default function AppLayout() {
  const location = useLocation();
  const isStorePage = location.pathname === "/store";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-wmdm-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TitleBar />
        <main className={`flex-1 overflow-hidden flex flex-col ${!isStorePage ? "pb-14" : ""}`}>
          <Outlet />
        </main>
      </div>
      {!isStorePage && <MiniPlayer />}
    </div>
  );
}
