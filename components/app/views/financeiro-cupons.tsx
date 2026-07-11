"use client";

/* Cupons & descontos — registre os códigos do evento e veja os resgates de
   verdade: o Nexo cruza o código com os campos de lead dos inscritos (Sympla,
   LP, planilha). Códigos que chegaram sem cadastro são detectados sozinhos. */
import { useState } from "react";
import {
  Badge, Card, ConfirmDialog, Empty, Field, Icon, Kpi, Menu, Modal, MoneyInput, PageHead, useToast,
} from "@/components/app/kit";
import {
  addCoupon,
  couponRedemptions,
  couponsOf,
  detectedCoupons,
  removeCoupon,
  selectedEvent,
  updateCoupon,
  useDb,
} from "@/lib/db";
import { couponSchema } from "@/lib/validations/operations";
import { fmtMoney } from "@/lib/format";
import type { Coupon, CouponKind } from "@/types";

const KIND_LABEL: Record<CouponKind, string> = {
  percent: "% de desconto",
  fixed: "R$ de desconto",
  cortesia: "Cortesia (100%)",
};

function couponValueLabel(c: Coupon): string {
  if (c.kind === "percent") return `${c.value}% off`;
  if (c.kind === "fixed") return `${fmtMoney(c.value)} off`;
  return "Cortesia";
}

function CouponModal({ eventId, presetCode, onClose }: {
  eventId: string; presetCode?: string; onClose: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    code: presetCode ?? "",
    kind: "percent" as CouponKind,
    value_cents: 0,
    percent: "",
    max_uses: "",
    note: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const parsed = couponSchema.safeParse({
      code: form.code,
      kind: form.kind,
      value: form.kind === "percent" ? form.percent : form.kind === "fixed" ? form.value_cents / 100 : 0,
      max_uses: form.max_uses === "" ? null : form.max_uses,
      note: form.note,
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
    addCoupon(eventId, { ...parsed.data, active: true });
    toast(`Cupom ${parsed.data.code} registrado`);
    onClose();
  };

  return (
    <Modal
      title="Registrar cupom"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>Registrar</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Código" error={errors.code}>
          <input
            className="input"
            placeholder="Ex.: FUNDADOR20"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            autoFocus
          />
        </Field>
        <Field label="Tipo" error={errors.kind}>
          <select
            className="input"
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as CouponKind }))}
          >
            {(Object.entries(KIND_LABEL) as [CouponKind, string][]).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </Field>
        {form.kind === "percent" && (
          <Field label="Percentual (%)" error={errors.value}>
            <input
              className="input"
              inputMode="numeric"
              placeholder="Ex.: 20"
              value={form.percent}
              onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value.replace(/\D/g, "") }))}
            />
          </Field>
        )}
        {form.kind === "fixed" && (
          <Field label="Valor do desconto" error={errors.value}>
            <MoneyInput cents={form.value_cents} onCents={(c) => setForm((f) => ({ ...f, value_cents: c }))} />
          </Field>
        )}
        <Field label="Limite de usos (opcional)" error={errors.max_uses}>
          <input
            className="input"
            inputMode="numeric"
            placeholder="Sem limite"
            value={form.max_uses}
            onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value.replace(/\D/g, "") }))}
          />
        </Field>
      </div>
      <Field label="Nota (opcional)" error={errors.note}>
        <input
          className="input"
          placeholder="Ex.: cupom da parceria com a comunidade X"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
      </Field>
      <p className="field-hint" style={{ margin: 0 }}>
        Os resgates são detectados automaticamente: qualquer campo de lead do inscrito com esse
        código conta como uso.
      </p>
    </Modal>
  );
}

export function FinanceiroCupons() {
  const db = useDb();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [presetCode, setPresetCode] = useState<string | undefined>(undefined);
  const [removing, setRemoving] = useState<Coupon | null>(null);

  const ev = selectedEvent(db);
  if (!ev) {
    return (
      <div className="view">
        <PageHead title="Cupons & descontos" sub="Nenhum evento criado ainda" />
        <Empty icon="ticket" title="Crie um evento primeiro" sub="Os cupons pertencem a um evento." />
      </div>
    );
  }

  const coupons = couponsOf(db, ev.id);
  const registered = new Set(coupons.map((c) => c.code));
  const detected = detectedCoupons(db, ev.id).filter((d) => !registered.has(d.code));
  const withHits = coupons.map((c) => ({ coupon: c, hits: couponRedemptions(db, ev.id, c.code) }));
  const totalHits = withHits.reduce((s, x) => s + x.hits.length, 0);
  const estDiscount = withHits.reduce((s, { coupon, hits }) => {
    if (coupon.kind === "fixed") return s + coupon.value * hits.length;
    return s; // % e cortesia dependem do preço do ingresso — não estimamos aqui
  }, 0);

  const openCreate = (code?: string) => {
    setPresetCode(code);
    setCreating(true);
  };

  return (
    <div className="view">
      <PageHead
        title="Cupons & descontos"
        sub={`${ev.name} · resgates cruzados com os campos de lead dos inscritos`}
        actions={
          <button className="btn btn-primary" onClick={() => openCreate()}>
            <Icon name="plus" size={15} />Registrar cupom
          </button>
        }
      />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <Kpi icon="ticket" value={coupons.length} label="Cupons registrados" />
        <Kpi
          icon="users"
          iconTone="green"
          value={totalHits}
          label="Resgates detectados nos inscritos"
        />
        <Kpi
          icon="wallet"
          value={estDiscount > 0 ? fmtMoney(estDiscount) : "—"}
          label="Desconto concedido (cupons de valor fixo)"
        />
      </div>

      {detected.length > 0 && (
        <Card title="Detectados nos inscritos (sem cadastro)" style={{ marginBottom: 16 }}>
          <div className="coupon-detected">
            {detected.slice(0, 8).map((d) => (
              <span className="coupon-chip" key={d.code}>
                <code>{d.code}</code>
                <b>{d.count}</b>
                <button className="btn btn-sm" onClick={() => openCreate(d.code)}>Registrar</button>
              </span>
            ))}
          </div>
          <p className="field-hint" style={{ marginTop: 10, marginBottom: 0 }}>
            Códigos que apareceram em campos de cupom/desconto dos leads e ainda não estão na sua lista.
          </p>
        </Card>
      )}

      <Card pad0>
        {coupons.length === 0 ? (
          <Empty
            icon="ticket"
            title="Nenhum cupom registrado"
            sub="Registre os códigos usados no ticketing/LP — os resgates aparecem sozinhos conforme os inscritos chegam."
            action={
              <button className="btn btn-primary" onClick={() => openCreate()}>
                <Icon name="plus" size={15} />Primeiro cupom
              </button>
            }
          />
        ) : (
          <div className="coupon-list">
            {withHits.map(({ coupon, hits }) => {
              const overLimit = coupon.max_uses != null && hits.length > coupon.max_uses;
              return (
                <div className="coupon-row" key={coupon.id}>
                  <span className="coupon-code"><code>{coupon.code}</code></span>
                  <span className="coupon-main">
                    <span className="coupon-top">
                      <span className="coupon-kind">{couponValueLabel(coupon)}</span>
                      {!coupon.active && <Badge tone="gray">inativo</Badge>}
                      {overLimit && <Badge tone="red">acima do limite</Badge>}
                    </span>
                    <span className="coupon-sub">
                      {hits.length} resgate{hits.length === 1 ? "" : "s"}
                      {coupon.max_uses != null && ` de ${coupon.max_uses}`}
                      {coupon.note && ` · ${coupon.note}`}
                    </span>
                  </span>
                  {coupon.max_uses != null && (
                    <span className="coupon-bar">
                      <i
                        className={overLimit ? "over" : ""}
                        style={{ width: Math.min(100, Math.round((hits.length / coupon.max_uses) * 100)) + "%" }}
                      />
                    </span>
                  )}
                  <Badge tone={hits.length > 0 ? "green" : "gray"}>{hits.length}</Badge>
                  <Menu
                    items={[
                      {
                        label: coupon.active ? "Desativar cupom" : "Reativar cupom",
                        onClick: () => {
                          updateCoupon(ev.id, coupon.id, { active: !coupon.active });
                          toast(coupon.active ? "Cupom desativado" : "Cupom reativado");
                        },
                      },
                      { label: "Excluir cupom", danger: true, onClick: () => setRemoving(coupon) },
                    ]}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {creating && (
        <CouponModal
          eventId={ev.id}
          presetCode={presetCode}
          onClose={() => {
            setCreating(false);
            setPresetCode(undefined);
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Excluir o cupom ${removing.code}?`}
          message="Só o registro é removido — os inscritos ficam como estão."
          confirmLabel="Excluir"
          tone="danger"
          icon="trash"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            removeCoupon(ev.id, removing.id);
            setRemoving(null);
            toast("Cupom excluído");
          }}
        />
      )}
    </div>
  );
}
