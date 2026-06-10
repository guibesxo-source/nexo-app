"use client";

/* Portado de app/views-extra.jsx (Membros) do protótipo. */
import { createElement as h } from "react";
import { Avatar, Icon, PageHead, useToast } from "@/components/app/kit";
import { MEMBERS } from "@/lib/demo-data";

export function Membros() {
  const toast = useToast();
  return h(
    "div",
    { className: "view" },
    h(PageHead, {
      title: "Membros",
      sub: "6 membros na organização",
      actions: [
        h("button", { className: "btn btn-primary", key: 1, onClick: () => toast("Convite enviado por email") }, h(Icon, { name: "mail", size: 15 }), "Convidar membro"),
      ],
    }),
    h(
      "div",
      { className: "member-grid" },
      MEMBERS.map((m, i) =>
        h(
          "div",
          { className: "member", key: i },
          h(Avatar, { initials: m.in, size: "lg" }),
          h("div", { className: "nm" }, m.nm),
          h("div", { className: "role" }, m.role),
          h(
            "div",
            { className: "stats" },
            h("div", { className: "st" }, h("div", { className: "v" }, m.tasks), h("div", { className: "k" }, "Tarefas")),
            h("div", { className: "st" }, h("div", { className: "v" }, m.events), h("div", { className: "k" }, "Eventos"))
          )
        )
      )
    )
  );
}
