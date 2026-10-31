"use client";

import { useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CornerDownLeft, LoaderCircle, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BARS = [0.5, 0.9, 0.6, 1, 0.45, 0.8, 0.55, 0.95, 0.5, 0.75, 0.4];

/** Purely decorative "listening" animation: CSS/Framer only, no audio APIs. */
function Waveform({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-5 items-center gap-[3px]" aria-hidden>
      {BARS.map((h, i) => (
        <motion.span
          key={i}
          className={cn("w-[3px] origin-center rounded-full", active ? "bg-primary" : "bg-muted-foreground/40")}
          style={{ height: 20 }}
          initial={{ scaleY: 0.18 }}
          animate={active && !reduce ? { scaleY: [0.18, h, 0.25, h * 0.7, 0.18] } : { scaleY: 0.18 }}
          transition={active && !reduce ? { duration: 1.6, repeat: Infinity, delay: i * 0.09, ease: "easeInOut" } : { duration: 0.2 }}
        />
      ))}
    </div>
  );
}

export function VoiceBar({
  value,
  onChange,
  onSubmit,
  loading,
  disabled,
  textareaRef,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  disabled?: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Rendered above the input, e.g. the staged-changes summary. */
  children?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const listening = focused && value.length === 0 && !loading && !disabled;
  const canSend = value.trim().length > 0 && !loading && !disabled;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 md:left-60">
      <div className="h-6 bg-gradient-to-t from-background to-transparent" />
      <div className="pointer-events-auto bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8">
        <div className="mx-auto w-full max-w-6xl space-y-2">
          {children}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSend) onSubmit();
            }}
            className={cn(
              "relative rounded-2xl border bg-surface p-2.5 shadow-[0_-8px_32px_-12px_rgba(0,0,0,0.6)] transition-[border-color,box-shadow] sm:p-3",
              focused ? "border-primary/60 shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_18%,transparent)]" : "border-border",
              disabled && "opacity-60",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2">
                <AnimatePresence>
                  {listening && (
                    <motion.span
                      key="pulse"
                      className="absolute inset-0 rounded-xl border border-primary/60"
                      initial={{ opacity: 0.7, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.5 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                </AnimatePresence>
                <Mic className={cn("size-4 transition-colors", listening ? "text-primary" : "text-muted-foreground")} strokeWidth={1.75} />
              </div>

              <div className="relative min-w-0 flex-1">
                <textarea
                  ref={textareaRef}
                  value={value}
                  rows={2}
                  disabled={disabled}
                  aria-label="Voice command"
                  onChange={(e) => onChange(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      if (canSend) onSubmit();
                    }
                  }}
                  placeholder={
                    disabled
                      ? "Nothing to review right now."
                      : "Hold your Wispr Flow key and speak — e.g. “Approve all the tasks, but give the OTP bug to Pragti due November 10th.”"
                  }
                  className="block max-h-40 min-h-[3rem] w-full resize-none bg-transparent py-1 text-[15px] leading-snug outline-none placeholder:text-muted-foreground/70"
                />
                <div className={cn("pointer-events-none absolute -bottom-1 right-0 transition-opacity", listening ? "opacity-100" : "opacity-0")}>
                  <Waveform active={listening} />
                </div>
              </div>

              <Button
                type="submit"
                disabled={!canSend}
                size="lg"
                className="mt-0.5 shrink-0 gap-1.5"
                aria-label="Preview command"
              >
                {loading ? <LoaderCircle className="animate-spin" /> : <CornerDownLeft />}
                <span className="hidden sm:inline">{loading ? "Reading…" : "Preview"}</span>
              </Button>
            </div>
            <p className="mt-1.5 hidden pl-12 text-[11px] text-muted-foreground sm:block">
              <kbd className="font-mono">Enter</kbd> to preview · <kbd className="font-mono">Shift+Enter</kbd> for a new line · nothing is sent until you confirm
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
