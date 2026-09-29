import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../sidebar/Sidebar";
import { Header } from "../header/Header";
import { AnimatePresence, motion } from "framer-motion";

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="h-screen flex bg-background text-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Draggable title bar region — allows window to be moved */}
        <div className="h-9 shrink-0 title-bar" />
        <Header />
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="min-h-full">
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
