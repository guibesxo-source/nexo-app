"use client";

/* Configurações — perfil, organização e preferências persistidos. */
import { useRef, useState } from "react";
import { Avatar, Card, Field, Icon, PageHead, Toggle, useToast } from "@/components/app/kit";
import { useGo } from "@/components/app/shell";
import {
  currentUser,
  resetDemo,
  setProfilePhoto,
  setToggle,
  updateProfile,
  updateWorkspace,
  useDb,
} from "@/lib/db";
import { compressImage } from "@/lib/files";

const SECTIONS: [string, string][] = [
  ["geral", "Geral"],
  ["notif", "Notificações"],
  ["team", "Equipe"],
  ["billing", "Plano & Cobrança"],
  ["api", "API & Integrações"],
];

const TOGGLE_GROUPS = [
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

export function Config() {
  const db = useDb();
  const toast = useToast();
  const go = useGo();
  const user = currentUser(db);
  const [navSec, setNavSec] = useState("geral");
  const [form, setForm] = useState({
    userName: user?.name ?? "",
    userEmail: user?.email ?? "",
    orgName: db.workspace.name,
    timezone: db.workspace.timezone,
  });

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const fileRef = useRef<HTMLInputElement>(null);
  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file || !user) return;
    try {
      // comprime para um quadrado leve (~256px) — cabe no localStorage
      const dataUrl = await compressImage(file, 256, 0.85);
      setProfilePhoto(user.id, dataUrl);
      toast("Foto de perfil atualizada");
    } catch {
      toast("Não consegui ler essa imagem");
    }
  };

  const save = () => {
    if (user && form.userName.trim()) {
      updateProfile(user.id, { name: form.userName.trim(), email: form.userEmail.trim() });
    }
    updateWorkspace({ name: form.orgName.trim() || db.workspace.name, timezone: form.timezone });
    toast("Alterações salvas");
  };

  const flip = (k: string) => (v: boolean) => {
    setToggle(k, v);
    toast("Preferência atualizada");
  };

  const showToggles =
    navSec === "geral" ? TOGGLE_GROUPS : navSec === "notif" ? [TOGGLE_GROUPS[0]] : [];

  return (
    <div className="view">
      <PageHead title="Configurações" sub="Gerencie sua conta e preferências da organização" />
      <div className="settings-wrap">
        <nav className="settings-nav">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              className={navSec === id ? "active" : ""}
              onClick={() =>
                id === "team"
                  ? go("membros")
                  : id === "api"
                    ? go("integracoes")
                    : setNavSec(id)
              }
            >
              {label}
            </a>
          ))}
        </nav>

        <div>
          {navSec === "geral" && (
            <Card style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <button
                  type="button"
                  className="avatar-edit"
                  onClick={() => fileRef.current?.click()}
                  title="Alterar foto de perfil"
                >
                  <Avatar initials={user?.initials ?? "?"} src={user?.avatar} size="lg" />
                  <span className="avatar-edit-badge"><Icon name="camera" size={12} /></span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={onPickPhoto}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{user?.name}</div>
                  <div style={{ fontSize: 13, color: "var(--dim)" }}>
                    {user?.email} · {user?.role === "owner" ? "Owner" : user?.role}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                      <Icon name="camera" size={14} />
                      {user?.avatar ? "Trocar foto" : "Adicionar foto"}
                    </button>
                    {user?.avatar && (
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          if (user) {
                            setProfilePhoto(user.id, null);
                            toast("Foto removida");
                          }
                        }}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Seu nome">
                  <input className="input" value={form.userName} onChange={set("userName")} />
                </Field>
                <Field label="Seu email">
                  <input className="input" type="email" value={form.userEmail} onChange={set("userEmail")} />
                </Field>
                <Field label="Nome da organização">
                  <input className="input" value={form.orgName} onChange={set("orgName")} />
                </Field>
                <Field label="Fuso horário">
                  <input className="input" value={form.timezone} onChange={set("timezone")} />
                </Field>
              </div>
            </Card>
          )}

          {showToggles.map((group) => (
            <Card key={group.sec} title={group.sec} style={{ marginBottom: 20 }}>
              {group.items.map((it) => (
                <div className="set-row" key={it.k}>
                  <div>
                    <div className="sr-name">{it.nm}</div>
                    <div className="sr-desc">{it.desc}</div>
                  </div>
                  <Toggle on={!!db.settings.toggles[it.k]} onChange={flip(it.k)} />
                </div>
              ))}
            </Card>
          ))}

          {navSec === "billing" && (
            <Card title="Plano & Cobrança" style={{ marginBottom: 20 }}>
              <div className="set-row">
                <div>
                  <div className="sr-name">Plano Fundador (beta)</div>
                  <div className="sr-desc">
                    Você está no acesso de fundador do beta privado — sem cobrança durante esta fase.
                    A assinatura via Stripe (mensal/anual com preço de fundador travado) chega com o beta.
                  </div>
                </div>
              </div>
            </Card>
          )}

          {navSec === "geral" && (
            <Card title="Zona de perigo" style={{ marginBottom: 20 }}>
              <div className="set-row">
                <div>
                  <div className="sr-name">Restaurar dados demo</div>
                  <div className="sr-desc">
                    Apaga todas as alterações feitas neste navegador e recarrega o workspace de demonstração.
                  </div>
                </div>
                <button
                  className="btn btn-sm"
                  style={{ color: "var(--red)", borderColor: "var(--red)" }}
                  onClick={() => {
                    if (confirm("Restaurar o workspace demo? Suas alterações locais serão perdidas.")) {
                      resetDemo();
                      toast("Dados demo restaurados");
                    }
                  }}
                >
                  Restaurar
                </button>
              </div>
            </Card>
          )}

          {(navSec === "geral" || navSec === "notif") && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-primary" onClick={save}>Salvar alterações</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
