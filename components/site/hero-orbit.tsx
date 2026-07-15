"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  FileSpreadsheet,
  ListChecks,
  UsersRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/* ---------- Headline do hero ----------
   Estática, com a assinatura da marca (pill verde −1°) na palavra "hub".
   Entra junto do reveal padrão da página — sem efeito de digitação. */

export function TypewriterHeading() {
  return (
    <h1 className="reveal mx-auto mt-6 max-w-[16ch] text-[clamp(38px,5.4vw,64px)] font-extrabold leading-[1.08] tracking-[-0.035em] lg:mx-0">
      O <span className="mark-pill">hub</span> que faz os seus eventos acontecerem.
    </h1>
  );
}

/* ---------- Órbitas do hub ----------
   4 anéis concêntricos girando devagar (direções alternadas); os módulos
   do Nexo orbitam como satélites — cada chip contra-gira pra ficar sempre
   em pé — e no centro um count-up "6+" ferramentas viram um hub só. */

const SATS: { orbit: 2 | 3 | 4; angle: number; icon: LucideIcon; label: string; delay: number }[] = [
  { orbit: 2, angle: 30, icon: Users, label: "Inscritos", delay: 0.6 },
  { orbit: 2, angle: 200, icon: ListChecks, label: "Checklist", delay: 0.85 },
  { orbit: 3, angle: 120, icon: Wallet, label: "Financeiro", delay: 1.1 },
  { orbit: 3, angle: 330, icon: CalendarDays, label: "Eventos", delay: 1.35 },
  { orbit: 4, angle: 70, icon: FileSpreadsheet, label: "CSV · Sympla", delay: 1.6 },
  { orbit: 4, angle: 185, icon: UsersRound, label: "Equipe ao vivo", delay: 1.85 },
  { orbit: 4, angle: 300, icon: BarChart3, label: "Relatórios", delay: 2.1 },
];

const ORBITS = {
  2: { size: 320, dir: "cw", dur: "40s" },
  3: { size: 450, dir: "cw", dur: "50s" },
  4: { size: 580, dir: "ccw", dur: "60s" },
} as const;

function useCountUp(to: number, ms = 2000, delay = 1200) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(to);
      return;
    }
    const t = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - t0) / ms, 1);
        setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); // easeOutCubic
        if (p < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf.current);
    };
  }, [to, ms, delay]);
  return v;
}

export function HeroOrbits() {
  const count = useCountUp(6);

  return (
    <div className="orbits-box" aria-hidden>
      <div className="orbits">
        {/* anéis */}
        <span className="ring cw" style={{ width: 190, height: 190, animationDuration: "30s" }} />
        {([2, 3, 4] as const).map((o) => (
          <span
            key={o}
            className={`ring ${ORBITS[o].dir}`}
            style={{ width: ORBITS[o].size, height: ORBITS[o].size, animationDuration: ORBITS[o].dur }}
          />
        ))}

        {/* hub central */}
        <div className="hub">
          <span className="hub-mark" />
          <div className="text-[52px] font-extrabold leading-none tracking-[-0.03em]">
            {count}
            <span className="text-green">+</span>
          </div>
          <div className="mt-1 text-[12px] font-bold uppercase tracking-[0.12em] text-white/50">
            ferramentas
          </div>
          <div className="text-[13px] font-bold text-green">num hub só</div>
        </div>

        {/* satélites */}
        {SATS.map(({ orbit, angle, icon: Icon, label, delay }) => {
          const { size, dir, dur } = ORBITS[orbit];
          return (
            <div
              key={label}
              className={`orbit ${dir}`}
              style={{ width: size, height: size, animationDuration: dur }}
            >
              <div
                className="sat"
                style={{
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${size / 2}px) rotate(${-angle}deg)`,
                }}
              >
                <div className={`sat-spin ${dir}`} style={{ animationDuration: dur }}>
                  <div className="sat-chip" style={{ animationDelay: `${delay}s` }}>
                    <Icon className="h-4 w-4 text-green" />
                    <span>{label}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
