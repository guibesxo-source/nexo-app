"use client";

/* Portado de app/views-main.jsx (Eventos) do protótipo. */
import { createElement as h, useState } from "react";
import { Avatar, Badge, Icon, PageHead } from "@/components/app/kit";
import { useGo } from "@/components/app/shell";
import { EVENTS } from "@/lib/demo-data";

export function Eventos() {
  const go = useGo();
  const [filter, setFilter] = useState("todos");
  const filters: [string, string, number][] = [
    ["todos", "Todos", 6], ["ativos", "Ativos", 2], ["plan", "Planejamento", 2], ["rasc", "Rascunhos", 1],
  ];
  return h(
    "div",
    { className: "view" },
    h(PageHead, {
      title: "Eventos",
      sub: "6 eventos · 1.852 inscritos no total",
      actions: [
        h("button", { className: "btn", key: 1 }, h(Icon, { name: "filter", size: 15 }), "Filtros"),
        h("button", { className: "btn btn-primary", key: 2 }, h(Icon, { name: "plus", size: 15 }), "Novo evento"),
      ],
    }),
    h(
      "div",
      { className: "row", style: { marginBottom: 20, gap: 8, flexWrap: "wrap" } },
      filters.map(([id, lb, ct]) =>
        h(
          "button",
          { key: id, className: "chip" + (filter === id ? " active" : ""), onClick: () => setFilter(id) },
          lb,
          h("span", { className: "ct" }, ct)
        )
      )
    ),

    h(
      "div",
      { className: "evlist" },
      EVENTS.map((ev) =>
        h(
          "div",
          { className: "evcard", key: ev.id, onClick: () => go("dashboard") },
          h(
            "div",
            { className: "evcard-cover", style: { background: ev.cover } },
            h("span", { className: "evcard-status" }, h(Badge, { tone: ev.status[0], dot: true }, ev.status[1]))
          ),
          h(
            "div",
            { className: "evcard-body" },
            h("div", { className: "nm" }, ev.nm),
            h(
              "div",
              { className: "meta" },
              h("span", { className: "row", style: { gap: 5 } }, h(Icon, { name: "calendar", size: 13 }), ev.date),
              h("span", { style: { opacity: 0.4 } }, "·"),
              h("span", { className: "row", style: { gap: 5 } }, h(Icon, { name: "mapPin", size: 13 }), ev.city)
            )
          ),
          h(
            "div",
            { className: "evcard-foot" },
            h(
              "div",
              null,
              h("div", { style: { fontSize: 13, fontWeight: 700 } }, ev.reg + " / " + ev.cap),
              h("div", { style: { fontSize: 11, color: "var(--dim)" } }, "inscritos")
            ),
            h(
              "div",
              { className: "avatar-stack" },
              ev.team.map((t) => h(Avatar, { key: t, initials: t, size: "sm" })),
              ev.extra > 0 && h("span", { className: "avatar sm more" }, "+" + ev.extra)
            )
          )
        )
      )
    )
  );
}
