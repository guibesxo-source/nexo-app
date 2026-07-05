"use client";

import { useEffect, useRef } from "react";

/* Camadas vivas do hero: um facho de luz e a grade "tech" se revelam ao redor
   do cursor, e dois orbs verdes flutuam com parallax — a mesma linguagem do
   painel de marca do login do app (a essência Nexo: preto + verde vivo).
   O movimento é suavizado por um loop RAF com lerp: as vars perseguem o
   cursor com inércia e, quando o mouse sai da dobra, ficam onde estão —
   nada de reset nem flash. Com prefers-reduced-motion, tudo estático. */
export function HeroFX() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current?.parentElement; // a <section class="hero">
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    host.classList.add("fx");

    // alvo (cursor) e posição atual (suavizada), em fração 0–1
    const target = { x: 0.5, y: 0.3 };
    const pos = { x: 0.5, y: 0.3 };
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      const r = host.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width;
      target.y = (e.clientY - r.top) / r.height;
    };

    const frame = () => {
      pos.x += (target.x - pos.x) * 0.07;
      pos.y += (target.y - pos.y) * 0.07;
      host.style.setProperty("--hx", `${(pos.x * 100).toFixed(2)}%`);
      host.style.setProperty("--hy", `${(pos.y * 100).toFixed(2)}%`);
      host.style.setProperty("--hpx", (pos.x * 2 - 1).toFixed(3));
      host.style.setProperty("--hpy", (pos.y * 2 - 1).toFixed(3));
      raf = requestAnimationFrame(frame);
    };

    host.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(frame);
    return () => {
      host.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      host.classList.remove("fx");
    };
  }, []);

  return (
    <div ref={ref} className="hero-fx" aria-hidden>
      <span className="hero-orb o1" />
      <span className="hero-orb o2" />
      <span className="hero-spot" />
    </div>
  );
}
