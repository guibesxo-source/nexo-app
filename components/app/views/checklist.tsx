"use client";

/* Portado de app/views-extra.jsx (Checklist) do protótipo. */
import { createElement as h, useState } from "react";
import { Avatar, Badge, Card, Icon, PageHead, useToast } from "@/components/app/kit";
import { TASK_GROUPS } from "@/lib/demo-data";

export function Checklist() {
  const toast = useToast();
  const init: Record<string, boolean> = {};
  TASK_GROUPS.forEach((g) => g.tasks.forEach((t) => (init[t.id] = t.done)));
  const [done, setDone] = useState(init);
  const total = Object.keys(init).length;
  const completed = Object.values(done).filter(Boolean).length;
  const pct = Math.round((completed / total) * 100);

  const toggle = (id: string, nm: string) => {
    setDone((d) => {
      const nv = !d[id];
      toast(nv ? "Tarefa concluída · " + nm : "Tarefa reaberta");
      return { ...d, [id]: nv };
    });
  };

  return h(
    "div",
    { className: "view" },
    h(PageHead, {
      title: "Checklist de produção",
      sub: completed + " de " + total + " tarefas concluídas · 3 atrasadas",
      actions: [
        h("button", { className: "btn", key: 1 }, h(Icon, { name: "filter", size: 15 }), "Filtrar"),
        h("button", { className: "btn btn-primary", key: 2, onClick: () => toast("Nova tarefa criada") }, h(Icon, { name: "plus", size: 15 }), "Nova tarefa"),
      ],
    }),

    h(
      Card,
      { style: { marginBottom: 20 } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 } },
        h("div", { style: { fontSize: 14, fontWeight: 700 } }, "Progresso geral"),
        h("div", { style: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" } }, pct + "%")
      ),
      h("div", { className: "prog-bar", style: { height: 9 } }, h("i", { style: { width: pct + "%" } })),
      h(
        "div",
        { style: { display: "flex", gap: 24, marginTop: 16 } },
        ([["Concluídas", completed, "var(--green-deep)"], ["Pendentes", total - completed, "var(--text)"], ["Atrasadas", 3, "var(--red)"]] as [string, number, string][]).map(([k, v, c], i) =>
          h(
            "div",
            { key: i },
            h("div", { style: { fontSize: 20, fontWeight: 800, color: c } }, v),
            h("div", { style: { fontSize: 11.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 } }, k)
          )
        )
      )
    ),

    TASK_GROUPS.map((grp, gi) => {
      const gd = grp.tasks.filter((t) => done[t.id]).length;
      return h(
        "div",
        { key: gi, className: "checklist" },
        h(
          "div",
          { className: "task-group-head" },
          h("span", { className: "tg-title" }, grp.g),
          h("span", { className: "tg-count" }, gd + "/" + grp.tasks.length),
          h("span", { className: "tg-line" })
        ),
        grp.tasks.map((t) =>
          h(
            "div",
            { className: "task" + (done[t.id] ? " done" : ""), key: t.id },
            h("span", { className: "checkbox", onClick: () => toggle(t.id, t.nm) }, h(Icon, { name: "check", size: 14 })),
            h(
              "div",
              { className: "task-main" },
              h("div", { className: "task-name" }, t.nm),
              h(
                "div",
                { className: "task-meta" },
                done[t.id]
                  ? h(Badge, { tone: "green", dot: true }, "Concluída")
                  : t.late
                    ? h(Badge, { tone: "red", dot: true }, "Atrasada")
                    : h(Badge, { tone: "gray", dot: true }, "Pendente"),
                h("span", { className: "row", style: { gap: 5 } }, h(Icon, { name: "clock", size: 12 }), t.due)
              )
            ),
            h("span", { className: "task-assignee" }, h(Avatar, { initials: t.who, size: "sm" }))
          )
        )
      );
    })
  );
}
