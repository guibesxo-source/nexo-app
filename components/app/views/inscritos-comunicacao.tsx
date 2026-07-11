"use client";

/* Comunicação — monta a mensagem (modelos com variáveis), escolhe o público
   (status ou segmento salvo) e entrega nos canais que você já usa: copiar
   e-mails em BCC, abrir o cliente de e-mail, WhatsApp por inscrito. O envio
   em massa fica na sua ferramenta (o CRM é do HubSpot — fora de escopo);
   aqui fica o histórico do que foi comunicado a quem. */
import { useMemo, useState } from "react";
import {
  Avatar, Card, Empty, Field, Icon, Menu, Modal, PageHead, useToast,
} from "@/components/app/kit";
import {
  addCommTemplate,
  allCommTemplates,
  commLogOf,
  leadPhone,
  logCommunication,
  removeCommTemplate,
  renderCommText,
  savedSegmentsOf,
  segmentAttendees,
  selectedEvent,
  useDb,
} from "@/lib/db";
import { commTemplateSchema } from "@/lib/validations/operations";
import { initialsOf, relTime } from "@/lib/format";
import type { Attendee, CommChannel } from "@/types";

const STATUS_AUDIENCES: [string, string][] = [
  ["st:todos", "Todos os ativos"],
  ["st:pendente", "Pendentes (cobrar confirmação)"],
  ["st:confirmado", "Confirmados"],
  ["st:checkin", "Com check-in (pós-evento)"],
];

export function InscritosComunicacao() {
  const db = useDb();
  const toast = useToast();
  const [channel, setChannel] = useState<CommChannel>("email");
  const [audience, setAudience] = useState("st:confirmado");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [waFor, setWaFor] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplErr, setTplErr] = useState("");

  const ev = selectedEvent(db);
  const segments = useMemo(() => (ev ? savedSegmentsOf(db, ev.id) : []), [db, ev]);
  const templates = allCommTemplates(db).filter((t) => t.channel === channel);

  const recipients: Attendee[] = useMemo(() => {
    if (!ev) return [];
    if (audience.startsWith("seg:")) {
      const seg = segments.find((s) => s.id === audience.slice(4));
      return seg ? segmentAttendees(db, ev.id, seg) : [];
    }
    const status = audience.slice(3);
    return segmentAttendees(db, ev.id, {
      status: (status === "todos" ? "todos" : status) as never,
      origin: "todos",
      q: null,
      field_key: null,
      field_value: null,
    });
  }, [db, ev, audience, segments]);

  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Comunicação" sub="Nenhum evento criado ainda" />
        <Empty icon="mail" title="Crie um evento primeiro" sub="A comunicação fala com os inscritos de um evento." />
      </div>
    );
  }

  const audienceLabel =
    STATUS_AUDIENCES.find(([id]) => id === audience)?.[1] ??
    segments.find((s) => "seg:" + s.id === audience)?.name ??
    "Público";
  const log = commLogOf(db, ev.id);
  const emails = [...new Set(recipients.map((a) => a.email).filter(Boolean))];
  const withPhone = recipients
    .map((a) => ({ a, phone: leadPhone(a) }))
    .filter((x): x is { a: Attendee; phone: string } => !!x.phone);
  const firstName = recipients[0]?.name;
  const previewBody = renderCommText(body || "Escreva a mensagem…", ev, firstName);
  const previewSubject = renderCommText(subject, ev, firstName);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setSubject(tpl.subject ?? "");
    setBody(tpl.body);
  };

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(msg);
    } catch {
      toast("Não consegui copiar automaticamente");
    }
  };

  const openMailClient = () => {
    const url =
      "mailto:?bcc=" +
      encodeURIComponent(emails.slice(0, 50).join(",")) +
      "&subject=" +
      encodeURIComponent(renderCommText(subject, ev)) +
      "&body=" +
      encodeURIComponent(renderCommText(body, ev));
    window.location.href = url;
  };

  const registerSend = () => {
    if (!body.trim() || recipients.length === 0) return;
    logCommunication(ev.id, {
      channel,
      subject: channel === "email" ? renderCommText(subject, ev) || "(sem assunto)" : renderCommText(body, ev).slice(0, 60),
      audience: audienceLabel,
      count: recipients.length,
    });
    toast("Comunicação registrada no histórico");
  };

  const saveTemplate = () => {
    const parsed = commTemplateSchema.safeParse({ name: tplName, channel, subject, body });
    if (!parsed.success) {
      setTplErr(parsed.error.issues[0]?.message ?? "Revise o modelo");
      return;
    }
    addCommTemplate(parsed.data);
    setSavingTpl(false);
    setTplName("");
    setTplErr("");
    toast("Modelo salvo");
  };

  return (
    <div className="view">
      <PageHead
        title="Comunicação"
        sub={`${ev.name} · o disparo em massa fica na sua ferramenta; o histórico fica aqui`}
        actions={
          <div className="seg">
            <button className={channel === "email" ? "active" : ""} onClick={() => { setChannel("email"); setTemplateId(""); }}>
              E-mail
            </button>
            <button className={channel === "whatsapp" ? "active" : ""} onClick={() => { setChannel("whatsapp"); setTemplateId(""); }}>
              WhatsApp
            </button>
          </div>
        }
      />

      <div className="comm-grid">
        <Card title="Mensagem">
          <div className="form-grid">
            <Field label="Público">
              <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
                <optgroup label="Por status">
                  {STATUS_AUDIENCES.map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </optgroup>
                {segments.length > 0 && (
                  <optgroup label="Segmentos salvos">
                    {segments.map((s) => (
                      <option key={s.id} value={"seg:" + s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </Field>
            <Field label="Modelo">
              <select className="input" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Começar do zero</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.builtin ? " (pronto)" : ""}</option>
                ))}
              </select>
            </Field>
          </div>

          {channel === "email" && (
            <Field label="Assunto">
              <input
                className="input"
                placeholder="Ex.: Sua vaga no {{evento}} está garantida"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Field>
          )}
          <Field label="Mensagem">
            <textarea
              className="input comm-body"
              rows={8}
              placeholder={"Olá {{nome}}!\n\nNos vemos no {{evento}}, dia {{data}}, em {{local}}."}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          <p className="field-hint">
            Variáveis: <code>{"{{nome}}"}</code> <code>{"{{evento}}"}</code> <code>{"{{data}}"}</code>{" "}
            <code>{"{{local}}"}</code> — nome é preenchido por destinatário (mail merge / WhatsApp individual).
          </p>

          <div className="comm-actions">
            {channel === "email" ? (
              <>
                <button className="btn" onClick={() => copy(emails.join(", "), `${emails.length} e-mails copiados (cole em BCC)`)} disabled={emails.length === 0}>
                  <Icon name="users" size={15} />Copiar {emails.length} e-mail{emails.length === 1 ? "" : "s"}
                </button>
                <button className="btn" onClick={() => copy(renderCommText(body, ev), "Mensagem copiada")} disabled={!body.trim()}>
                  <Icon name="note" size={15} />Copiar mensagem
                </button>
                <button
                  className="btn"
                  onClick={openMailClient}
                  disabled={emails.length === 0 || emails.length > 50 || !body.trim()}
                  title={emails.length > 50 ? "Acima de 50 destinatários, use a sua ferramenta de disparo" : undefined}
                >
                  <Icon name="mail" size={15} />Abrir no e-mail
                </button>
              </>
            ) : (
              <>
                <button className="btn" onClick={() => copy(renderCommText(body, ev), "Mensagem copiada")} disabled={!body.trim()}>
                  <Icon name="note" size={15} />Copiar mensagem
                </button>
                <button className="btn" onClick={() => setWaFor(true)} disabled={withPhone.length === 0 || !body.trim()}>
                  <Icon name="users" size={15} />Enviar 1 a 1 ({withPhone.length} com telefone)
                </button>
              </>
            )}
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={() => setSavingTpl(true)} disabled={!body.trim()}>
              <Icon name="save" size={15} />Salvar modelo
            </button>
            <button className="btn btn-primary" onClick={registerSend} disabled={!body.trim() || recipients.length === 0}>
              <Icon name="check" size={15} />Registrar envio
            </button>
          </div>
        </Card>

        <div className="comm-side">
          <Card title="Prévia">
            <div className="comm-preview">
              <div className="comm-preview-head">
                <span className="comm-preview-to">
                  Para: <b>{audienceLabel}</b> · {recipients.length} pessoa{recipients.length === 1 ? "" : "s"}
                </span>
                {channel === "email" && (
                  <span className="comm-preview-subj">{previewSubject || "(sem assunto)"}</span>
                )}
              </div>
              <div className="comm-preview-body">{previewBody}</div>
              {firstName && (
                <div className="comm-preview-note">prévia com o 1º destinatário: {firstName}</div>
              )}
            </div>
          </Card>

          <Card title="Histórico" style={{ marginTop: 16 }}>
            {log.length === 0 ? (
              <Empty icon="mail" title="Nada registrado" sub="Cada envio registrado aparece aqui — quem recebeu o quê, e quando." />
            ) : (
              <div className="comm-log">
                {log.slice(0, 10).map((e) => (
                  <div className="comm-log-row" key={e.id}>
                    <span className={"comm-log-ic " + e.channel}>
                      <Icon name={e.channel === "email" ? "mail" : "users"} size={14} />
                    </span>
                    <span className="comm-log-main">
                      <span className="comm-log-subj">{e.subject}</span>
                      <span className="comm-log-sub">
                        {e.audience} · {e.count} destinatário{e.count === 1 ? "" : "s"} · {relTime(e.sent_at)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {db.settings.comm_templates && db.settings.comm_templates.length > 0 && (
            <Card title="Meus modelos" style={{ marginTop: 16 }}>
              <div className="comm-log">
                {db.settings.comm_templates.map((t) => (
                  <div className="comm-log-row" key={t.id}>
                    <span className={"comm-log-ic " + t.channel}>
                      <Icon name={t.channel === "email" ? "mail" : "users"} size={14} />
                    </span>
                    <span className="comm-log-main">
                      <span className="comm-log-subj">{t.name}</span>
                      <span className="comm-log-sub">{t.channel === "email" ? t.subject : t.body.slice(0, 48)}</span>
                    </span>
                    <Menu
                      items={[
                        {
                          label: "Usar modelo",
                          onClick: () => {
                            setChannel(t.channel);
                            setTemplateId(t.id);
                            setSubject(t.subject ?? "");
                            setBody(t.body);
                          },
                        },
                        { label: "Excluir modelo", danger: true, onClick: () => removeCommTemplate(t.id) },
                      ]}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {waFor && (
        <Modal
          title={`WhatsApp 1 a 1 · ${withPhone.length} com telefone`}
          onClose={() => setWaFor(false)}
          width={520}
          footer={<button className="btn" onClick={() => setWaFor(false)}>Fechar</button>}
        >
          {withPhone.length === 0 ? (
            <Empty icon="users" title="Ninguém com telefone" sub="O telefone vem dos campos do lead (LP/Sympla/planilha)." />
          ) : (
            <div className="wa-list">
              {withPhone.map(({ a, phone }) => (
                <div className="wa-row" key={a.id}>
                  <Avatar initials={initialsOf(a.name)} size="sm" />
                  <span className="wa-main">
                    <span className="wa-nm">{a.name}</span>
                    <span className="wa-sub">{phone}</span>
                  </span>
                  <a
                    className="btn btn-sm btn-primary"
                    href={
                      "https://wa.me/" +
                      (phone.length <= 11 ? "55" + phone : phone) +
                      "?text=" +
                      encodeURIComponent(renderCommText(body, ev, a.name))
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir
                  </a>
                </div>
              ))}
            </div>
          )}
          <p className="field-hint" style={{ marginTop: 10 }}>
            Cada link abre o WhatsApp com a mensagem personalizada ({"{{nome}}"} vira o nome real).
          </p>
        </Modal>
      )}

      {savingTpl && (
        <Modal
          title="Salvar como modelo"
          onClose={() => setSavingTpl(false)}
          width={420}
          footer={
            <>
              <button className="btn" onClick={() => setSavingTpl(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveTemplate}>Salvar</button>
            </>
          }
        >
          <Field label="Nome do modelo" error={tplErr} style={{ marginBottom: 0 }}>
            <input
              className="input"
              placeholder='Ex.: "Lembrete véspera (WhatsApp)"'
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveTemplate()}
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}
