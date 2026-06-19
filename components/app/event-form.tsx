"use client";

/* Modal de criar/editar evento (FR-B1) — Zod na borda do formulário. */
import { useRef, useState } from "react";
import { Field, Icon, Modal, MoneyInput, useToast } from "@/components/app/kit";
import {
  allTemplates,
  applyTemplate,
  createEvent,
  createHubspotIngest,
  EVENT_COVERS,
  updateEvent,
  useDb,
} from "@/lib/db";
import { HubspotWebhookModal } from "@/components/app/hubspot-webhook";
import { SymplaEventsModal } from "@/components/app/sympla-events";
import { eventSchema } from "@/lib/validations/event";
import { compressImage } from "@/lib/files";
import type { Event, EventPriority, EventStatus } from "@/types";

export const EVENT_STATUS_OPTIONS: [EventStatus, string][] = [
  ["rascunho", "Rascunho"],
  ["planejamento", "Planejamento"],
  ["confirmado", "Ativo"],
  ["encerrado", "Encerrado"],
  ["cancelado", "Cancelado"],
];

export function EventFormModal({ event, onClose }: { event?: Event; onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: event?.name ?? "",
    starts_at: event?.starts_at.slice(0, 16) ?? "",
    location: event?.location ?? "",
    capacity: event ? String(event.capacity) : "",
    budget_cents: event ? Math.round(event.budget_planned * 100) : 0,
    status: (event?.status ?? "planejamento") as EventStatus,
    format: event?.format ?? "",
    priority: (event?.priority ?? "media") as EventPriority,
    cover: event?.cover ?? EVENT_COVERS[db.events.length % EVENT_COVERS.length].css,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Checklist inicial (só na criação): segue o formato escolhido até o
  // usuário mexer no select — aí a escolha manual passa a valer.
  const templates = allTemplates(db);
  const [templateId, setTemplateId] = useState("");
  const [templateTouched, setTemplateTouched] = useState(false);

  // Integração inicial (só na criação): após criar o evento, encaminha pro fluxo
  // da integração escolhida — HubSpot (gera o webhook + snippet) ou Sympla
  // (abre a importação para vincular este evento).
  const [integration, setIntegration] = useState("");
  const [handoff, setHandoff] = useState<
    { id: string; name: string; integration: "hubspot" | "sympla" } | null
  >(null);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const onFormat = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const format = e.target.value;
    setForm((f) => ({ ...f, format }));
    if (!event && !templateTouched) {
      const match = templates.find((t) => t.builtin && t.format === format);
      setTemplateId(match?.id ?? "");
    }
  };

  // Capa enviada pelo usuário vira `url(...)` — convive com os gradientes.
  const customCover = form.cover.startsWith("url(") ? form.cover : null;

  const onCoverFile = async (file: File) => {
    try {
      const dataUrl = await compressImage(file, 1200, 0.82);
      setForm((f) => ({ ...f, cover: `url("${dataUrl}")` }));
    } catch {
      toast("Não consegui ler essa imagem — tente JPG ou PNG");
    }
  };

  const submit = () => {
    const parsed = eventSchema.safeParse({
      name: form.name,
      starts_at: form.starts_at,
      location: form.location,
      capacity: form.capacity,
      budget_planned: form.budget_cents / 100,
      status: form.status,
      cover: form.cover,
      format: form.format || undefined,
      priority: form.priority,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0]);
        if (!errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    if (event) {
      updateEvent(event.id, parsed.data);
      toast("Evento atualizado");
      onClose();
      return;
    }

    const id = createEvent(parsed.data);
    const tpl = templates.find((t) => t.id === templateId);
    const n = tpl ? applyTemplate(id, tpl) : 0;

    // Handoff para a integração escolhida (mantém o modal aberto trocando o passo).
    if (integration === "hubspot") {
      createHubspotIngest(id);
      toast("Evento criado · configure o recebimento via LP");
      setHandoff({ id, name: parsed.data.name, integration: "hubspot" });
      return;
    }
    if (integration === "sympla") {
      if (!db.settings.sympla_token) {
        toast("Evento criado · conecte o Sympla em Integrações para importar");
        onClose();
        return;
      }
      toast("Evento criado · escolha o evento do Sympla para vincular");
      setHandoff({ id, name: parsed.data.name, integration: "sympla" });
      return;
    }

    toast(tpl ? `Evento criado · ${n} ${n === 1 ? "tarefa" : "tarefas"} no checklist` : "Evento criado");
    onClose();
  };

  // Passo seguinte: o evento já existe; entrega o fluxo da integração escolhida.
  if (handoff?.integration === "hubspot") {
    return <HubspotWebhookModal eventId={handoff.id} eventName={handoff.name} onClose={onClose} />;
  }
  if (handoff?.integration === "sympla") {
    return <SymplaEventsModal onClose={onClose} />;
  }

  return (
    <Modal
      title={event ? "Editar evento" : "Novo evento"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>
            {event ? "Salvar alterações" : "Criar evento"}
          </button>
        </>
      }
    >
      <Field label="Nome do evento" error={errors.name}>
        <input
          className="input"
          placeholder="Ex.: Summit de Marketing 2027"
          value={form.name}
          onChange={set("name")}
          autoFocus
        />
      </Field>
      <div className="form-grid">
        <Field label="Data e hora" error={errors.starts_at}>
          <input className="input" type="datetime-local" value={form.starts_at} onChange={set("starts_at")} />
        </Field>
        <Field label="Local" error={errors.location}>
          <input className="input" placeholder="Cidade ou Online" value={form.location} onChange={set("location")} />
        </Field>
        <Field label="Meta de inscritos" error={errors.capacity}>
          <input className="input" type="number" min={1} value={form.capacity} onChange={set("capacity")} />
        </Field>
        <Field label="Orçamento previsto" error={errors.budget_planned}>
          <MoneyInput
            cents={form.budget_cents}
            onCents={(c) => setForm((f) => ({ ...f, budget_cents: c }))}
          />
        </Field>
      </div>
      <Field label="Capa do evento" error={errors.cover}>
        <div className="cover-grid">
          {EVENT_COVERS.map((c) => (
            <button
              type="button"
              key={c.id}
              className={"cover-swatch" + (form.cover === c.css ? " active" : "")}
              style={{ backgroundImage: c.css }}
              title={c.name}
              aria-pressed={form.cover === c.css}
              onClick={() => setForm((f) => ({ ...f, cover: c.css }))}
            >
              <span className="cover-name">{c.name}</span>
            </button>
          ))}
          {customCover ? (
            <button
              type="button"
              className="cover-swatch active"
              style={{ backgroundImage: customCover, backgroundSize: "cover", backgroundPosition: "center", animation: "none" }}
              title="Trocar imagem"
              onClick={() => coverFileRef.current?.click()}
            >
              <span className="cover-name">Sua capa</span>
            </button>
          ) : (
            <button
              type="button"
              className="cover-swatch cover-upload"
              title="Enviar imagem de capa"
              onClick={() => coverFileRef.current?.click()}
            >
              <Icon name="image" size={16} />
              Sua capa
            </button>
          )}
        </div>
        <input
          ref={coverFileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && onCoverFile(e.target.files[0])}
        />
        <p className="cover-hint">
          Imagem própria: recomendado <b>1200 × 400 px</b> (proporção 3:1), JPG ou PNG —
          ela é otimizada automaticamente.
        </p>
      </Field>
      <div className="form-grid">
        <Field label="Formato" error={errors.format}>
          <select className="input" value={form.format} onChange={onFormat}>
            <option value="">A definir</option>
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
            <option value="hibrido">Híbrido</option>
          </select>
        </Field>
        <Field label="Status" error={errors.status}>
          <select className="input" value={form.status} onChange={set("status")}>
            {EVENT_STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="form-grid">
        <Field label="Prioridade" error={errors.priority} style={{ marginBottom: 0 }}>
          <select className="input" value={form.priority} onChange={set("priority")}>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </Field>
        {!event && (
          <Field label="Checklist inicial" style={{ marginBottom: 0 }}>
            <select
              className="input"
              value={templateId}
              onChange={(e) => { setTemplateId(e.target.value); setTemplateTouched(true); }}
            >
              <option value="">Começar em branco</option>
              <optgroup label="Templates">
                {templates.filter((t) => t.builtin).map((t) => (
                  <option key={t.id} value={t.id}>{t.name} · {t.items.length} tarefas</option>
                ))}
              </optgroup>
              {templates.some((t) => !t.builtin) && (
                <optgroup label="Seus templates">
                  {templates.filter((t) => !t.builtin).map((t) => (
                    <option key={t.id} value={t.id}>{t.name} · {t.items.length} tarefas</option>
                  ))}
                </optgroup>
              )}
            </select>
            {templateId && (
              <p className="cover-hint">
                As tarefas entram com prazos calculados a partir da data do evento.
              </p>
            )}
          </Field>
        )}
        {!event && (
          <Field label="Integração inicial" style={{ marginBottom: 0 }}>
            <select
              className="input"
              value={integration}
              onChange={(e) => setIntegration(e.target.value)}
            >
              <option value="">Nenhuma</option>
              <option value="hubspot">HubSpot · receber via LP (sem API)</option>
              <option value="sympla">Sympla · importar inscritos</option>
            </select>
            {integration === "hubspot" && (
              <p className="cover-hint">
                Ao criar, geramos o endpoint e mostramos o snippet pra colar na sua landing page.
              </p>
            )}
            {integration === "sympla" && (
              <p className="cover-hint">
                {db.settings.sympla_token
                  ? "Ao criar, abrimos a importação do Sympla pra vincular este evento."
                  : "Conecte o Sympla em Integrações para usar esta opção."}
              </p>
            )}
          </Field>
        )}
      </div>
    </Modal>
  );
}
