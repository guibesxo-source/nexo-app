"use client";

/* Portado de app/views-main.jsx (Dashboard) do protótipo. */
import { createElement as h } from "react";
import { BarChart, Card, Donut, Icon, Kpi, PageHead } from "@/components/app/kit";
import { useGo } from "@/components/app/shell";

export function Dashboard() {
  const go = useGo();
  const weeks = [
    { l: "S1", v: 28 }, { l: "S2", v: 42 }, { l: "S3", v: 38 }, { l: "S4", v: 60 },
    { l: "S5", v: 52 }, { l: "S6", v: 78 }, { l: "S7", v: 92 }, { l: "S8", v: 65 },
  ];
  return h(
    "div",
    { className: "view" },
    h(PageHead, {
      eyebrow: "Summit de Marketing 2026",
      title: "Visão geral",
      sub: "Atualizado agora · 3 membros online",
      actions: [
        h("button", { className: "btn", key: 1 }, h(Icon, { name: "download", size: 15 }), "Exportar"),
        h("button", { className: "btn btn-primary", key: 2 }, h(Icon, { name: "plus", size: 15 }), "Novo evento"),
      ],
    }),

    h(
      "div",
      { className: "kpi-grid" },
      h(Kpi, { icon: "users", iconTone: "green", value: "320", label: "Inscritos totais", delta: "18 hoje", deltaDir: "up" }),
      h(Kpi, { icon: "check", value: "247", label: "Confirmados · 77%", delta: "+12", deltaDir: "up" }),
      h(Kpi, { icon: "wallet", value: "82%", label: "Orçamento usado", delta: "no plano", deltaDir: "flat" }),
      h(Kpi, { icon: "checkSquare", value: "17/24", label: "Tarefas concluídas", delta: "3 atrasadas", deltaDir: "down" })
    ),

    h(
      "div",
      { className: "grid-2", style: { marginBottom: 16 } },
      h(
        Card,
        { title: "Inscritos por semana", link: "Ver relatório", onLink: () => go("inscritos") },
        h(BarChart, { data: weeks, lastAlt: true }),
        h(
          "div",
          { style: { display: "flex", gap: 18, marginTop: 16, fontSize: 12.5, color: "var(--dim)" } },
          h("span", { className: "row", style: { gap: 7 } }, h("span", { style: { width: 10, height: 10, borderRadius: 3, background: "var(--green)", display: "inline-block" } }), "Inscrições confirmadas"),
          h("span", { className: "row", style: { gap: 7 } }, h("span", { style: { width: 10, height: 10, borderRadius: 3, background: "#E2E2DE", display: "inline-block" } }), "Semana atual (parcial)")
        )
      ),

      h(
        Card,
        { title: "Confirmação" },
        h(Donut, {
          pct: 62,
          label: "conf.",
          legend: [
            { color: "var(--green)", label: "Confirmados", value: "247" },
            { color: "#E8E8E5", label: "Pendentes", value: "73" },
          ],
        }),
        h(
          "div",
          { style: { marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line-2)", fontSize: 12.5, color: "var(--dim)" } },
          "Custo por inscrito: ",
          h("b", { style: { color: "var(--text)" } }, "R$ 461")
        )
      )
    ),

    h(
      "div",
      { className: "grid-2" },
      h(
        Card,
        { title: "Atividade recente", link: "Ver tudo" },
        h(
          "div",
          { className: "activity" },
          [
            { ic: "👤", txt: ["Mariana Costa", " confirmou presença no Summit"], t: "há 4 minutos" },
            { ic: "💰", txt: ["Lançamento de ", "R$ 12.450", " em Marketing aprovado"], t: "há 1 hora" },
            { ic: "✅", txt: ["Diego Almeida", ' concluiu "Fechar contrato de catering"'], t: "há 3 horas" },
            { ic: "🎫", txt: ["18 novos inscritos", " via campanha de Instagram"], t: "há 5 horas" },
            { ic: "⚠️", txt: ["Tarefa ", '"Enviar save-the-date"', " está atrasada"], t: "ontem" },
          ].map((a, i) =>
            h(
              "div",
              { className: "act-row", key: i },
              h("span", { className: "act-ic" }, a.ic),
              h(
                "div",
                { className: "act-body" },
                h("div", { className: "act-txt" }, a.txt.map((s, j) => (j % 2 ? h("b", { key: j }, s) : s))),
                h("div", { className: "act-time" }, a.t)
              )
            )
          )
        )
      ),

      h(
        Card,
        { title: "Progresso por área" },
        h(
          "div",
          { className: "progress-list" },
          [
            { nm: "Captação de inscritos", v: 77 },
            { nm: "Orçamento executado", v: 82 },
            { nm: "Checklist de produção", v: 71 },
            { nm: "Patrocínios fechados", v: 60 },
          ].map((p, i) =>
            h(
              "div",
              { className: "prog-item", key: i },
              h(
                "div",
                { className: "prog-top" },
                h("span", { className: "nm" }, p.nm),
                h("span", { className: "vl" }, p.v + "%")
              ),
              h("div", { className: "prog-bar" }, h("i", { style: { width: p.v + "%" } }))
            )
          )
        ),
        h(
          "div",
          { style: { marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line-2)", display: "flex", alignItems: "center", justifyContent: "space-between" } },
          h(
            "div",
            null,
            h("div", { style: { fontSize: 12.5, color: "var(--dim)" } }, "Dias para o evento"),
            h("div", { style: { fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" } }, "8 dias")
          ),
          h("button", { className: "btn btn-dark btn-sm", onClick: () => go("checklist") }, "Ver checklist")
        )
      )
    )
  );
}
