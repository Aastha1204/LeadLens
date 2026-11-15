"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useAnimationControls, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { ArrowLeft, Bell, BellOff, FileText, Send, Check, CheckCheck } from "lucide-react";
import { fmtTime } from "@/lib/format";
import { LANG_LABEL } from "@/lib/whatsapp/summary";
import { changeLang, deliverMonthlyReport, sendUserText } from "@/lib/whatsapp/actions";
import { cn } from "@/lib/utils";
import { useDemo, type ChatMsg, type Lang } from "@/store/demo";

const CHIPS = ["WON 186 120000", "LOST 201 price", "HELP"];

/** WhatsApp-style chat in a CSS-3D phone (tilt + parallax). Chat stays crisp and clickable. */
export function Phone({ className, fill, messages, preview }: { className?: string; fill?: boolean; messages?: ChatMsg[]; preview?: boolean }) {
  const storeChat = useDemo((s) => s.chat);
  const chat = messages ?? storeChat;
  const typing = useDemo((s) => s.botTyping);
  const lang = useDemo((s) => s.lang);
  const soundOn = useDemo((s) => s.soundOn);
  const reduce = useReducedMotion();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [viewing, setViewing] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const buzz = useAnimationControls();
  const seen = useRef(chat.length);

  const mx = useMotionValue(0), my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 120, damping: 18 });
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 120, damping: 18 });

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [chat.length, typing]);
  useEffect(() => {
    const last = chat[chat.length - 1];
    if (chat.length > seen.current && last?.from === "bot" && !reduce) buzz.start({ x: [0, -5, 5, -4, 4, -2, 0], transition: { duration: 0.45 } });
    seen.current = chat.length;
  }, [chat, buzz, reduce]);

  const openLink = (href: string) => {
    if (window.matchMedia("(min-width: 1024px)").matches) router.push(href);
    else setViewing(href);
  };
  const submit = (text: string) => { if (!text.trim()) return; setDraft(""); void sendUserText(text); };

  return (
    <div style={{ perspective: 1200 }} className={className}>
      <motion.div animate={buzz}>
        <motion.div
          ref={frame}
          style={reduce || fill ? undefined : { rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
          onMouseMove={(e) => { const r = frame.current!.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5); }}
          onMouseLeave={() => { mx.set(0); my.set(0); }}
          className={cn("relative mx-auto flex flex-col overflow-hidden rounded-[38px] border-[9px] border-neutral-900 bg-[#efeae2] text-neutral-900 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.55)]", fill ? "h-full w-full" : "h-[min(620px,calc(100dvh-7rem))] w-[300px]")}
        >
          <div className="absolute left-1/2 top-0 z-20 h-4 w-24 -translate-x-1/2 rounded-b-2xl bg-neutral-900" />
          {/* header */}
          <div className="z-10 flex items-center gap-2 bg-[#075e54] px-3 pb-2 pt-6 text-white">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--neovia-primary)] text-[11px] font-bold">N</span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-semibold">Neovia LeadLens</p>
              <p className="text-[10px] text-white/70">{typing ? "typing…" : "Business account"}</p>
            </div>
            <div className="flex overflow-hidden rounded-full bg-black/20 text-[10px]" role="group" aria-label="Summary language">
              {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                <button key={l} onClick={() => changeLang(l)} aria-pressed={lang === l} className={cn("px-1.5 py-0.5", lang === l && "bg-white/30 font-semibold")}>{LANG_LABEL[l]}</button>
              ))}
            </div>
            <button aria-label={soundOn ? "Mute notification sound" : "Enable notification sound"} onClick={() => useDemo.getState().setSound(!soundOn)} className="text-white/80">
              {soundOn ? <Bell size={14} /> : <BellOff size={14} />}
            </button>
          </div>

          {/* messages */}
          <div ref={scroller} className="flex-1 space-y-1.5 overflow-y-auto px-2.5 py-3 text-[12.5px]" aria-live="polite">
            {chat.length === 0 && !typing && !preview && (
              <div className="mx-auto mt-6 max-w-[210px] rounded-lg bg-white/80 p-3 text-center text-[11px] text-neutral-600">
                Your monthly report arrives here on the 1st.
                <button onClick={() => void deliverMonthlyReport()} className="mt-2 block w-full rounded-full bg-[#075e54] px-3 py-1.5 text-[11px] font-medium text-white">Deliver October report</button>
              </div>
            )}
            {chat.map((m) => <Bubble key={m.id} m={m} onLink={openLink} />)}
            {typing && (
              <div className="w-14 rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-sm" aria-label="typing">
                <span className="flex gap-1">{[0, 1, 2].map((i) => <motion.span key={i} className="size-1.5 rounded-full bg-neutral-400" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />)}</span>
              </div>
            )}
          </div>

          {/* composer */}
          {!preview && <div className="z-10 bg-[#f0f0f0] px-2 pb-2 pt-1.5">
            <div className="mb-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
              {CHIPS.map((c) => <button key={c} onClick={() => submit(c)} className="shrink-0 rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10.5px] font-medium text-[#075e54]">{c}</button>)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); submit(draft); }} className="flex items-center gap-1.5">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Reply, e.g. WON 186 120000" aria-label="Message" className="min-w-0 flex-1 rounded-full bg-white px-3 py-2 text-[12.5px] outline-none" />
              <button type="submit" aria-label="Send" className="grid size-8 shrink-0 place-items-center rounded-full bg-[#075e54] text-white"><Send size={14} /></button>
            </form>
          </div>}

          {viewing && (
            <div className="absolute inset-0 z-30 flex flex-col bg-white">
              <button onClick={() => setViewing(null)} className="flex items-center gap-1.5 bg-[#075e54] px-3 pb-2 pt-6 text-[12px] text-white"><ArrowLeft size={14} /> Back to chat</button>
              <iframe title="Report" src={viewing} className="w-full flex-1 border-0" />
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

function Bubble({ m, onLink }: { m: ChatMsg; onLink: (href: string) => void }) {
  const mine = m.from === "user";
  const parts = m.text.split("[link]");
  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[86%] rounded-lg px-2.5 py-1.5 shadow-sm", mine ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white")}>
        {m.kind === "doc" && m.doc && (
          <div className="mb-1 flex items-center gap-2 rounded-md bg-neutral-100 p-2">
            <span className="grid size-8 place-items-center rounded bg-red-500 text-white"><FileText size={16} /></span>
            <div className="min-w-0 text-[11px] leading-tight"><p className="truncate font-medium">{m.doc.name}</p><p className="text-neutral-500">{m.doc.pages} pages · PDF</p></div>
          </div>
        )}
        {m.text && (
          <p className="whitespace-pre-wrap break-words">
            {parts.map((p, i) => (
              <span key={i}>{p}{i < parts.length - 1 && m.href && (
                <button onClick={() => onLink(m.href!)} className="text-[#027eb5] underline">leadlens.neoviaai.in/r/LL-UN-{m.href.split("/").pop()}</button>
              )}</span>
            ))}
          </p>
        )}
        <p className="mt-0.5 flex items-center justify-end gap-0.5 text-[9.5px] text-neutral-500">{fmtTime(m.at)}{mine && (m.id ? <CheckCheck size={11} className="text-sky-500" /> : <Check size={11} />)}</p>
      </div>
    </motion.div>
  );
}
