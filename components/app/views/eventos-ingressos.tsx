"use client";

/* Ingressos & lotes — planejamento de back-office: lotes com preço, quantidade
   e vigência; a ocupação é derivada dos inscritos reais (pelo tipo de ingresso).
   A venda em si continua no ticketing (Sympla etc.) — fora de escopo do Nexo. */
import { useState } from "react";
import {
  Badge, Card, ConfirmDialog, Empty, Field, Icon, Kpi, Menu, Modal, MoneyInput, PageHead, Toggle, useToast,
} from "@/components/app/kit";
import {
  addTicketBatch,
  batchStats,
  removeTicketBatch,
  selectedEvent,
  ticketBatchesOf,
  ticketTypeStats,
  updateTicketBatch,
  useDb,
} from "@/lib/db";
import { ticketBatchSchema } from "@/lib/validations/operations";
import { fmtDateShort, fmtMoney } from "@/lib/format";
import type { TicketBatch } from "@/types";

function BatchModal({ eventId, batch, presetName, onClose }: {
  eventId: string; batch?: TicketBatch; presetName?: string; onClose: () => void;
}) {
  const toast = useToast();
  const editing = !!batch;
  const [form, setForm] = useState({
    name: batch?.name ?? presetName ?? "",
    price_cents: batch ? Math.round(batch.price * 100) : 0,
    quantity: batch ? String(batch.quantity) : "",
    starts_on: batch?.starts_on ?? "",
    ends_on: batch?.ends_on ?? "",
    active: batch?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const parsed = ticketBatchSchema.safeParse({
      name: form.name,
      price: form.price_cents / 100,
      quantity: form.quantity,
      starts_on: form.starts_on,
      ends_on: form.ends_on,
      active: form.active,
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
    if (editing) {
      updateTicketBatch(eventId, batch.id, parsed.data);
      toast("Lote atualizado");
    } else {
      addTicketBatch(eventId, parsed.data);
      toast("Lote criado");
    }
    onClose();
  };

  return (
    <Modal
      title={editing ? "Editar lote" : "Novo lote"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>{editing ? "Salvar" : "Criar lote"}</button>
        </>
      }
    >
      <Field label="Nome do lote / tipo de ingresso" error={errors.name}>
        <input
          className="input"
          placeholder='Ex.: "Lote 1", "VIP", "Cortesia"'
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          autoFocus
        />
      </Field>
      <p className="field-hint">
        A ocupação casa este nome com o tipo de ingresso dos inscritos (Sympla/planilha/manual).
      </p>
      <div className="form-grid">
        <Field label="Preço (0 = gratuito)" error={errors.price}>
          <MoneyInput
            cents={form.price_cents}
            onCents={(c) => setForm((f) => ({ ...f, price_cents: c }))}
          />
        </Field>
        <Field label="Quantidade de vagas" error={errors.quantity}>
          <input
            className="input"
            inputMode="numeric"
            placeholder="Ex.: 100"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value.replace(/\D/g, "") }))}
          />
        </Field>
        <Field label="Início da vigência (opcional)" error={errors.starts_on}>
          <input
            className="input"
            type="date"
            value={form.starts_on}
            onChange={(e) => setForm((f) => ({ ...f, starts_on: e.target.value }))}
          />
        </Field>
        <Field label="Fim da vigência (opcional)" error={errors.ends_on}>
          <input
            className="input"
            type="date"
            value={form.ends_on}
            onChange={(e) => setForm((f) => ({ ...f, ends_on: e.target.value }))}
          />
        </Field>
      </div>
      <div className="row" style={{ gap: 10, marginTop: 4 }}>
        <Toggle on={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} />
        <span className="field-hint" style={{ margin: 0 }}>
          Lote {form.active ? "ativo (à venda no ticketing)" : "pausado/encerrado"}
        </span>
      </div>
    </Modal>
  );
}

export function EventosIngressos() {
  const db = useDb();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [presetName, setPresetName] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState<TicketBatch | null>(null);
  const [removing, setRemoving] = useState<TicketBatch | null>(null);

  const ev = selectedEvent(db);
  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Ingressos & lotes" sub="Nenhum evento criado ainda" />
        <Empty icon="ticket" title="Crie um evento primeiro" sub="Os lotes pertencem a um evento." />
      </div>
    );
  }

  const batches = ticketBatchesOf(db, ev.id);
  const types = ticketTypeStats(db, ev.id);
  const stats = batches.map((b) => ({ batch: b, ...batchStats(db, ev.id, b) }));
  const totalPlanned = batches.reduce((sum, b) => sum + b.quantity, 0);
  const totalSold = stats.reduce((sum, s) => sum + s.sold, 0);
  const totalRevenue = stats.reduce((sum, s) => sum + s.revenue, 0);
  const knownNames = new Set(batches.map((b) => b.name.trim().toLowerCase()));
  const unplanned = types.filter((t) => !knownNames.has(t.name.toLowerCase()));
  const overCapacity = ev.capacity > 0 && totalPlanned > ev.capacity;

  const openCreate = (name?: string) => {
    setPresetName(name);
    setCreating(true);
  };

  return (
    <div className="view">
      <PageHead
        title="Ingressos & lotes"
        sub={`${ev.name} · a venda fica no ticketing; aqui você controla ocupação e projeção`}
        actions={
          <button className="btn btn-primary" onClick={() => openCreate()}>
            <Icon name="plus" size={15} />Novo lote
          </button>
        }
      />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <Kpi
          icon="ticket"
          iconTone="green"
          value={totalSold}
          label="Inscritos nos lotes"
          foot={
            totalPlanned > 0
              ? {
                  text: `${Math.round((totalSold / totalPlanned) * 100)}% das ${totalPlanned} vagas planejadas`,
                  tone: totalSold >= totalPlanned ? "green" : "gray",
                }
              : undefined
          }
        />
        <Kpi
          icon="grid"
          value={totalPlanned || "—"}
          label="Vagas planejadas (lotes)"
          foot={
            overCapacity
              ? { text: `acima da lotação do evento (${ev.capacity})`, tone: "red" }
              : ev.capacity > 0
                ? { text: `lotação do evento: ${ev.capacity}`, tone: "gray" }
                : undefined
          }
        />
        <Kpi icon="wallet" value={fmtMoney(totalRevenue)} label="Receita projetada (inscritos × preço)" />
        <Kpi icon="users" value={types.length} label="Tipos de ingresso em uso" />
      </div>

      <Card
        title="Lotes planejados"
        actions={batches.length > 0 ? (
          <span className="card-link">{batches.filter((b) => b.active).length} ativo{batches.filter((b) => b.active).length === 1 ? "" : "s"}</span>
        ) : undefined}
      >
        {batches.length === 0 ? (
          <Empty
            icon="ticket"
            title="Nenhum lote planejado"
            sub="Crie lotes com preço, quantidade e vigência — a ocupação vem dos inscritos reais."
            action={
              <button className="btn btn-primary" onClick={() => openCreate()}>
                <Icon name="plus" size={15} />Primeiro lote
              </button>
            }
          />
        ) : (
          <div className="batch-list">
            {stats.map(({ batch, sold, pct, revenue }) => (
              <div className="batch-row" key={batch.id}>
                <span className="batch-main">
                  <span className="batch-top">
                    <span className="batch-nm">{batch.name}</span>
                    {!batch.active && <Badge tone="gray">pausado</Badge>}
                    {batch.active && pct >= 100 && <Badge tone="green">esgotado</Badge>}
                    <span className="batch-price">
                      {batch.price > 0 ? fmtMoney(batch.price) : "Gratuito"}
                    </span>
                  </span>
                  <span className="batch-bar">
                    <i className={pct >= 100 ? "full" : ""} style={{ width: Math.min(100, Math.max(sold > 0 ? 3 : 0, pct)) + "%" }} />
                  </span>
                  <span className="batch-sub">
                    {sold}/{batch.quantity} vagas · {pct}%
                    {batch.price > 0 && <> · {fmtMoney(revenue)} projetado</>}
                    {(batch.starts_on || batch.ends_on) && (
                      <>
                        {" · "}
                        {batch.starts_on ? fmtDateShort(batch.starts_on) : "…"}
                        {" → "}
                        {batch.ends_on ? fmtDateShort(batch.ends_on) : "…"}
                      </>
                    )}
                  </span>
                </span>
                <Menu
                  items={[
                    { label: "Editar lote", onClick: () => setEditing(batch) },
                    {
                      label: batch.active ? "Pausar lote" : "Reativar lote",
                      onClick: () => {
                        updateTicketBatch(ev.id, batch.id, { active: !batch.active });
                        toast(batch.active ? "Lote pausado" : "Lote reativado");
                      },
                    },
                    { label: "Excluir lote", danger: true, onClick: () => setRemoving(batch) },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Tipos de ingresso em uso pelos inscritos"
        style={{ marginTop: 16 }}
      >
        {types.length === 0 ? (
          <Empty
            icon="users"
            title="Sem inscritos ainda"
            sub="Quando os inscritos chegarem (Sympla, LP ou planilha), os tipos aparecem aqui."
          />
        ) : (
          <div className="ttype-list">
            {types.map((t) => {
              const planned = !knownNames.has(t.name.toLowerCase());
              return (
                <div className="ttype-row" key={t.name}>
                  <span className="ttype-ic"><Icon name="ticket" size={15} /></span>
                  <span className="ttype-main">
                    <span className="ttype-nm">{t.name}</span>
                    <span className="ttype-sub">
                      {t.count} inscrito{t.count === 1 ? "" : "s"}
                      {t.checkin > 0 && <> · {t.checkin} check-in{t.checkin === 1 ? "" : "s"}</>}
                    </span>
                  </span>
                  {planned ? (
                    <button className="btn btn-sm" onClick={() => openCreate(t.name)}>
                      <Icon name="plus" size={14} />Planejar lote
                    </button>
                  ) : (
                    <Badge tone="green" dot>com lote</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {unplanned.length > 0 && batches.length > 0 && (
          <p className="field-hint" style={{ marginTop: 10 }}>
            {unplanned.length} tipo{unplanned.length === 1 ? "" : "s"} sem lote planejado — crie o lote
            com o mesmo nome para acompanhar ocupação e projeção.
          </p>
        )}
      </Card>

      {(creating || editing) && (
        <BatchModal
          eventId={ev.id}
          batch={editing ?? undefined}
          presetName={presetName}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            setPresetName(undefined);
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Excluir o lote “${removing.name}”?`}
          message="Os inscritos não são afetados — só o planejamento do lote é removido."
          confirmLabel="Excluir"
          tone="danger"
          icon="trash"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            removeTicketBatch(ev.id, removing.id);
            setRemoving(null);
            toast("Lote excluído");
          }}
        />
      )}
    </div>
  );
}
