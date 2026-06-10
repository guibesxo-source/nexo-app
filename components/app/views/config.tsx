"use client";

/* Portado de app/views-extra.jsx (Configurações) do protótipo. */
import { createElement as h, useState } from "react";
import { Avatar, Card, PageHead, Toggle, useToast } from "@/components/app/kit";

export function Config() {
  const toast = useToast();
  const [tg, setTg] = useState<Record<string, boolean>>({
    email: true, push: true, weekly: false, slack: true, public: false, twofa: true,
  });
  const set = (k: string) => () => {
    setTg((s) => ({ ...s, [k]: !s[k] }));
    toast("Preferência atualizada");
  };
  const [navSec, setNavSec] = useState("geral");

  const rows = [
    {
      sec: "Notificações",
      items: [
        { k: "email", nm: "Notificações por email", desc: "Receba resumos diários e alertas importantes no seu email." },
        { k: "push", nm: "Notificações push", desc: "Avisos em tempo real de novos inscritos e tarefas." },
        { k: "weekly", nm: "Resumo semanal", desc: "Um panorama de todos os eventos toda segunda-feira." },
        { k: "slack", nm: "Integração com Slack", desc: "Envie atualizações de eventos para um canal do Slack." },
      ],
    },
    {
      sec: "Privacidade & Segurança",
      items: [
        { k: "public", nm: "Página de evento pública", desc: "Permitir que qualquer pessoa veja a página de inscrição." },
        { k: "twofa", nm: "Autenticação em dois fatores", desc: "Camada extra de segurança no login da sua conta." },
      ],
    },
  ];

  return h(
    "div",
    { className: "view" },
    h(PageHead, { title: "Configurações", sub: "Gerencie sua conta e preferências da organização" }),
    h(
      "div",
      { className: "settings-wrap" },
      h(
        "nav",
        { className: "settings-nav" },
        ([["geral", "Geral"], ["notif", "Notificações"], ["team", "Equipe"], ["billing", "Plano & Cobrança"], ["api", "API & Integrações"]] as [string, string][]).map(([id, lb]) =>
          h("a", { key: id, className: navSec === id ? "active" : "", onClick: () => setNavSec(id) }, lb)
        )
      ),

      h(
        "div",
        null,
        h(
          Card,
          { style: { marginBottom: 20 } },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 16 } },
            h(Avatar, { initials: "LF", size: "lg" }),
            h(
              "div",
              { style: { flex: 1 } },
              h("div", { style: { fontSize: 16, fontWeight: 700 } }, "Lucas Ferraz"),
              h("div", { style: { fontSize: 13, color: "var(--dim)" } }, "lucas@nexo.events · Owner")
            ),
            h("button", { className: "btn btn-sm" }, "Editar perfil")
          ),
          h(
            "div",
            { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 20 } },
            h("div", null, h("label", { className: "field-label" }, "Nome da organização"), h("input", { className: "input", defaultValue: "Nexo Events Co." })),
            h("div", null, h("label", { className: "field-label" }, "Fuso horário"), h("input", { className: "input", defaultValue: "(GMT-3) São Paulo" }))
          )
        ),

        rows.map((r, i) =>
          h(
            Card,
            { key: i, title: r.sec, style: { marginBottom: 20 } },
            r.items.map((it) =>
              h(
                "div",
                { className: "set-row", key: it.k },
                h("div", null, h("div", { className: "sr-name" }, it.nm), h("div", { className: "sr-desc" }, it.desc)),
                h(Toggle, { on: tg[it.k], onChange: set(it.k) })
              )
            )
          )
        ),

        h(
          "div",
          { style: { display: "flex", justifyContent: "flex-end", gap: 10 } },
          h("button", { className: "btn" }, "Cancelar"),
          h("button", { className: "btn btn-primary", onClick: () => toast("Alterações salvas") }, "Salvar alterações")
        )
      )
    )
  );
}
