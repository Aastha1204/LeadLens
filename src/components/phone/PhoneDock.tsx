"use client";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useDemo } from "@/store/demo";
import { Phone } from "./Phone";

/** Floating phone toggle, bottom-right, on every client screen. */
export function PhoneDock() {
  const pathname = usePathname();
  const { phoneOpen, unread, hydrated, togglePhone } = useDemo();
  if (!hydrated || !pathname.startsWith("/c/")) return null;
  return (
    <div data-chrome data-tour="dock" className="no-print fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 max-sm:left-2 max-sm:right-2">
      <AnimatePresence>
        {phoneOpen && (
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.95 }}
            className="max-sm:h-[calc(100dvh-5.5rem)] max-sm:w-full sm:w-[320px]">
            <Phone fill={false} className="max-sm:h-full [&>div]:max-sm:h-full [&>div>div]:max-sm:!h-full [&>div>div]:max-sm:!w-full" />
          </motion.div>
        )}
      </AnimatePresence>
      <button onClick={() => togglePhone()} aria-label={phoneOpen ? "Hide phone" : "Show WhatsApp phone"} aria-expanded={phoneOpen}
        className="relative grid size-13 place-items-center rounded-full bg-[#25d366] text-white shadow-lg transition-transform hover:scale-105">
        {phoneOpen ? <X size={22} /> : <MessageCircle size={24} />}
        {!phoneOpen && unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-red-500 text-[10px] font-bold">{unread}</span>}
      </button>
    </div>
  );
}
