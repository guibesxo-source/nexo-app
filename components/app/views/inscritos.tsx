"use client";

/* Portado de app/views-main.jsx (Inscritos) do protótipo. */
import { createElement as h, useState } from "react";
import { Avatar, Badge, Icon, PageHead, useToast } from "@/components/app/kit";
import { PEOPLE } from "@/lib/demo-data";

export function Inscritos() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("todos");
  const tabs: [string, string, number][] = [
    ["todos", "Todos", 320], ["conf", "Confirmados", 247], ["pend", "Pendentes", 73], ["check", "Check-in", 88],
  ];
  const stMap: Record<string, string> = { conf: "Confirmado", pend: "Pendente", check: "Check-in" };
  const rows = PEOPLE.filter((p) => {
    const okTab = tab === "todos" || p.st[1] === stMap[tab];
    const okQ = !q || (p.nm + p.em + p.co).toLowerCase().includes(q.toLowerCase());
    return okTab && okQ;
  });
  return h(
    "div",
    { className: "view" },
    h(PageHead, {
      title: "Inscritos",
      sub: "320 participantes · 247 confirmados",
      actions: [
        h("button", { className: "btn", key: 1, onClick: () => toast("Exportação iniciada (CSV)") }, h(Icon, { name: "download", size: 15 }), "Exportar CSV"),
        h("button", { className: "btn btn-primary", key: 2, onClick: () => toast("Convite enviado") }, h(Icon, { name: "plus", size: 15 }), "Adicionar"),
      ],
    }),
    h(
      "div",
      { className: "row", style: { marginBottom: 16, gap: 10, flexWrap: "wrap" } },
      h(
        "div",
        { className: "input-search", style: { maxWidth: 320 } },
        h(Icon, { name: "search", size: 16 }),
        h("input", {
          placeholder: "Buscar por nome, email ou empresa...",
          value: q,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value),
        })
      ),
      h("div", { style: { flex: 1 } }),
      tabs.map(([id, lb, ct]) =>
        h(
          "button",
          { key: id, className: "chip" + (tab === id ? " active" : ""), onClick: () => setTab(id) },
          lb,
          h("span", { className: "ct" }, ct)
        )
      )
    ),

    h(
      "div",
      { className: "tbl-wrap" },
      h(
        "table",
        { className: "tbl" },
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            h("th", null, "Participante"),
            h("th", null, "Empresa"),
            h("th", null, "Ingresso"),
            h("th", null, "Status"),
            h("th", null, "Inscrição"),
            h("th", null, "")
          )
        ),
        h(
          "tbody",
          null,
          rows.length === 0
            ? h("tr", null, h("td", { colSpan: 6, style: { textAlign: "center", padding: 40, color: "var(--dim)" } }, "Nenhum inscrito encontrado."))
            : rows.map((p, i) =>
                h(
                  "tr",
                  { key: i },
                  h(
                    "td",
                    null,
                    h(
                      "div",
                      { className: "cell-user" },
                      h(Avatar, { initials: p.in }),
                      h("div", null, h("div", { className: "nm" }, p.nm), h("div", { className: "em" }, p.em))
                    )
                  ),
                  h("td", null, p.co),
                  h("td", null, h(Badge, { tone: p.ticket === "VIP" ? "green" : p.ticket === "Pro" ? "blue" : "gray" }, p.ticket)),
                  h("td", null, h(Badge, { tone: p.st[0], dot: true }, p.st[1])),
                  h("td", { style: { color: "var(--dim)" } }, p.reg),
                  h("td", null, h("span", { className: "row-action" }, h(Icon, { name: "dots", size: 16 })))
                )
              )
        )
      ),
      h(
        "div",
        { className: "tbl-foot" },
        h("span", null, "Mostrando " + rows.length + " de 320 inscritos"),
        h(
          "div",
          { className: "pager" },
          h("button", { className: "active" }, "1"),
          h("button", null, "2"),
          h("button", null, "3"),
          h("button", null, h(Icon, { name: "chevRight", size: 14 }))
        )
      )
    )
  );
}
