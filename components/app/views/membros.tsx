"use client";

/* Membros — gestão local da equipe do workspace (multiusuário real
   com convites por email entra no beta, FR-A3). */
import { useState } from "react";
import {
  Avatar, Field, Icon, Menu, Modal, PageHead, useToast,
} from "@/components/app/kit";
import { addMember, memberStats, removeMember, useDb } from "@/lib/db";
import { z } from "zod";
import type { MemberRole } from "@/types";

const memberSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  email: z.email("Email inválido"),
  title: z.string().trim().min(2, "Informe a função"),
  role: z.enum(["admin", "member", "viewer"]),
});

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Membro",
  viewer: "Leitor",
};

function MemberFormModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "", email: "", title: "", role: "member" as MemberRole,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    const parsed = memberSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0]);
        if (!errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    addMember(parsed.data);
    toast("Membro adicionado à organização");
    onClose();
  };

  return (
    <Modal
      title="Convidar membro"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>Adicionar</button>
        </>
      }
    >
      <Field label="Nome completo" error={errors.name}>
        <input className="input" value={form.name} onChange={set("name")} autoFocus />
      </Field>
      <Field label="Email" error={errors.email}>
        <input className="input" type="email" value={form.email} onChange={set("email")} />
      </Field>
      <div className="form-grid">
        <Field label="Função" error={errors.title}>
          <input className="input" placeholder="Ex.: Coordenadora" value={form.title} onChange={set("title")} />
        </Field>
        <Field label="Papel" error={errors.role}>
          <select className="input" value={form.role} onChange={set("role")}>
            <option value="admin">Admin</option>
            <option value="member">Membro</option>
            <option value="viewer">Leitor</option>
          </select>
        </Field>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--dim)" }}>
        Convites por email com login próprio chegam no beta (multiusuário em tempo real).
      </div>
    </Modal>
  );
}

export function Membros() {
  const db = useDb();
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  return (
    <div className="view">
      <PageHead
        title="Membros"
        sub={`${db.members.length} membro${db.members.length === 1 ? "" : "s"} na organização`}
        actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Icon name="mail" size={15} />Convidar membro
          </button>
        }
      />
      <div className="member-grid">
        {db.members.map((m) => {
          const stats = memberStats(db, m.id);
          return (
            <div className="member" key={m.id} style={{ position: "relative" }}>
              {m.role !== "owner" && (
                <span style={{ position: "absolute", top: 10, right: 10 }}>
                  <Menu
                    items={[
                      {
                        label: "Remover da organização",
                        danger: true,
                        onClick: () => {
                          if (confirm(`Remover ${m.name} da organização?`)) {
                            removeMember(m.id);
                            toast("Membro removido");
                          }
                        },
                      },
                    ]}
                  />
                </span>
              )}
              <Avatar initials={m.initials} size="lg" />
              <div className="nm">{m.name}</div>
              <div className="role">{ROLE_LABEL[m.role]} · {m.title}</div>
              <div className="stats">
                <div className="st">
                  <div className="v">{stats.tasks}</div>
                  <div className="k">Tarefas</div>
                </div>
                <div className="st">
                  <div className="v">{stats.events}</div>
                  <div className="k">Eventos</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {adding && <MemberFormModal onClose={() => setAdding(false)} />}
    </div>
  );
}
