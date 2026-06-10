"use client";

/* Portado de app/views-main.jsx (Financeiro) do protótipo. */
import { createElement as h, useState } from "react";
import { Badge, Card, Icon, Kpi, PageHead, useToast } from "@/components/app/kit";
import { CATS, TX } from "@/lib/demo-data";

export function Financeiro() {
  const toast = useToast();
  const [seg, setSeg] = useState("despesas");
  const list = seg === "receitas" ? TX.filter((t) => t.dir === "in") : seg === "despesas" ? TX.filter((t) => t.dir === "out") : TX;
  return h(
    "div",
    { className: "view" },
    h(PageHead, {
      title: "Financeiro",
      sub: "Summit de Marketing 2026 · Orçamento R$ 180.000",
      actions: [
        h("button", { className: "btn", key: 1, onClick: () => toast("Relatório gerado") }, h(Icon, { name: "download", size: 15 }), "Relatório"),
        h("button", { className: "btn btn-primary", key: 2, onClick: () => toast("Lançamento adicionado") }, h(Icon, { name: "plus", size: 15 }), "Lançamento"),
      ],
    }),

    h(
      "div",
      { className: "grid-2", style: { marginBottom: 16 } },
      h(
        "div",
        { className: "budget-card" },
        h("div", { className: "lbl" }, "Gasto até agora"),
        h("div", { className: "big" }, "R$ 147.620", h("span", { className: "cents" }, ",00")),
        h("div", { className: "sub" }, "82% do orçamento · R$ 32.380 disponível"),
        h("div", { className: "bbar" }, h("i", { style: { width: "82%" } }))
      ),
      h(
        Card,
        { title: "Por categoria" },
        CATS.map((c, i) =>
          h(
            "div",
            { className: "cat-row", key: i },
            h("span", { className: "nm" }, c.nm),
            h("span", { className: "vl" }, c.vl),
            h("div", { className: "bar" }, h("i", { style: { width: c.pct + "%", background: c.c } }))
          )
        )
      )
    ),

    h(
      "div",
      { className: "kpi-grid", style: { gridTemplateColumns: "repeat(3,1fr)" } },
      h(Kpi, { icon: "arrowDown", value: "R$ 147.620", label: "Total de despesas", delta: "34 lançamentos", deltaDir: "flat" }),
      h(Kpi, { icon: "arrowUp", iconTone: "green", value: "R$ 25.000", label: "Receitas (patrocínio)", delta: "1 confirmada", deltaDir: "up" }),
      h(Kpi, { icon: "clock", value: "R$ 8.900", label: "Pendente de pagamento", delta: "1 NF", deltaDir: "flat" })
    ),

    h(
      Card,
      { pad0: true, style: { marginTop: 4 } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid var(--line)" } },
        h("div", { className: "card-title" }, "Lançamentos"),
        h(
          "div",
          { className: "seg" },
          ([["todos", "Todos"], ["despesas", "Despesas"], ["receitas", "Receitas"]] as [string, string][]).map(([id, lb]) =>
            h("button", { key: id, className: seg === id ? "active" : "", onClick: () => setSeg(id) }, lb)
          )
        )
      ),
      list.map((t, i) =>
        h(
          "div",
          { className: "tx-row", key: i },
          h("span", { className: "tx-ic" }, t.ic),
          h("div", null, h("div", { className: "ttl" }, t.ttl), h("div", { className: "meta" }, t.meta)),
          h(Badge, { tone: t.st[0] }, t.st[1]),
          h("span", { className: "tx-amt " + t.dir }, t.amt)
        )
      )
    )
  );
}
