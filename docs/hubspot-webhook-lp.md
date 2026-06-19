# Receber inscritos de um formulário HubSpot (LP HTML) no Nexo — sem API

Quando o formulário do HubSpot vive num portal sem acesso à API (ex.: o portal da
Prolog), dá pra mandar cada submissão direto pro evento no Nexo: a própria
landing page avisa o Nexo no envio do formulário (callback do embed → webhook).
**Não usa a API do HubSpot.**

## Como funciona

```
LP HTML (embed HubSpot)
  └─ onFormSubmit → POST https://<seu-nexo>.vercel.app/api/ingest/hubspot
                         { token, fields:[{name,value}...], pageUrl, submittedAt }
        ▼
Nexo (route público) → valida o token → grava o inscrito no evento (service role)
        ▼
Inscrito aparece no dashboard do evento (status "pendente"), com UTM e campos extras.
```

- O **token** é o segredo da URL: ele amarra os recebimentos a **um evento**.
- Dedup por e-mail dentro do evento (reenvios do mesmo e-mail são ignorados).
- A verdade-mãe continua no HubSpot; o Nexo é um espelho dos leads.

## Passo a passo

1. No Nexo, abra o **evento** que vai receber os inscritos (selecione no topo).
2. Vá em **APIs & Integrações → HubSpot → "Receber via LP"**.
3. Clique em **Gerar endpoint de recebimento**. Copie o **snippet**.
4. Cole o snippet no **HTML da sua LP**, de preferência logo antes de `</body>`,
   na mesma página onde está o formulário do HubSpot.
5. Publique a LP e faça um envio de teste — o inscrito deve cair no evento (recarregue a tela de Inscritos).

## Snippet (cole na LP)

O modal já entrega este snippet com a sua URL e token preenchidos. Ele escuta o
`postMessage` do embed do HubSpot e, no `onFormSubmit` (antes dos campos serem
limpos), lê os inputs do formulário e envia ao Nexo. Funciona com os embeds v2 e
v4 sem precisar mexer no `hbspt.forms.create`.

```html
<!-- Nexo · envia cada submissão do formulário HubSpot para o evento -->
<script>
(function () {
  var NEXO_URL = "https://SEU-NEXO.vercel.app/api/ingest/hubspot";
  var NEXO_TOKEN = "COLE_O_TOKEN_DO_EVENTO";
  function collect(form) {
    if (!form) return [];
    return Array.prototype.map.call(
      form.querySelectorAll("input[name], select[name], textarea[name]"),
      function (el) { return { name: el.name, value: el.value }; }
    ).filter(function (f) { return f.name && f.value; });
  }
  function send(fields) {
    if (!fields.length) return;
    try {
      fetch(NEXO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: NEXO_TOKEN, fields: fields, pageUrl: location.href, submittedAt: Date.now() }),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }
  function fromPayload(d) {
    if (Array.isArray(d)) return d;
    if (d && Array.isArray(d.submissionValues)) return d.submissionValues;
    if (d && d.submissionValues && typeof d.submissionValues === "object")
      return Object.keys(d.submissionValues).map(function (k) { return { name: k, value: d.submissionValues[k] }; });
    return [];
  }
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.type !== "hsFormCallback") return;
    if (e.data.eventName !== "onFormSubmit" && e.data.eventName !== "onFormSubmitted") return;
    var fields = fromPayload(e.data.data); // funciona com formulário em iframe
    if (!fields.length) {                  // embed inline: lê os inputs do DOM
      var form = document.querySelector("form.hs-form") || document.querySelector(".hs-form form") || document.querySelector("form");
      fields = collect(form);
    }
    send(fields);
  });
})();
</script>
```

## Alternativa: embed v2 (`hbspt.forms.create`)

Se você monta o formulário com `hbspt.forms.create({...})` e prefere não usar o
listener acima, dá pra enviar direto no callback `onFormSubmit`:

```html
<script>
  hbspt.forms.create({
    portalId: "SEU_PORTAL",
    formId: "SEU_FORM_ID",
    onFormSubmit: function ($form) {
      var fields = Array.prototype.map.call(
        $form[0].querySelectorAll("input[name], select[name], textarea[name]"),
        function (el) { return { name: el.name, value: el.value }; }
      ).filter(function (f) { return f.name && f.value; });
      fetch("https://SEU-NEXO.vercel.app/api/ingest/hubspot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "COLE_O_TOKEN", fields: fields, pageUrl: location.href, submittedAt: Date.now() }),
        keepalive: true
      });
    }
  });
</script>
```

## Mapeamento de campos

| Campo do formulário (name interno) | Vira no Nexo |
| --- | --- |
| `email` (ou qualquer campo com cara de e-mail) | E-mail do inscrito |
| `firstname` + `lastname` / `fullname` / `name` | Nome |
| `company` | Empresa |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | Dados do lead (UTM) |
| Demais campos com valor | Dados do lead (campos extras) |

Sem `email` válido a submissão é ignorada (resposta 200, pra LP não acusar erro).

## Teste rápido (sem a LP)

```bash
curl -X POST "https://SEU-NEXO.vercel.app/api/ingest/hubspot" \
  -H "Content-Type: application/json" \
  -d '{"token":"COLE_O_TOKEN","fields":[{"name":"email","value":"ana@teste.com"},{"name":"firstname","value":"Ana"},{"name":"utm_source","value":"instagram"}]}'
# → {"status":"created"}  (repetindo o mesmo e-mail → {"status":"skipped"})
```

## Pré-requisitos / notas

- **Aplicar a migration `supabase/migrations/0002_ingest_endpoints.sql`** no
  Supabase (cria a tabela `ingest_endpoints` e garante a coluna `attendees.lead_fields`).
- O Nexo precisa estar publicado numa **URL pública** (Vercel) — a LP precisa
  alcançá-lo pela internet. Em desenvolvimento local, use um túnel (ngrok/cloudflared).
- Variáveis necessárias no ambiente do Nexo: `NEXT_PUBLIC_SUPABASE_URL` e
  `SUPABASE_SERVICE_ROLE_KEY` (a service role só roda no servidor, nunca no browser).
- Para travar a origem, dá pra preencher `allowed_origin` na linha do endpoint
  (hoje via banco; sem isso, qualquer origem com o token é aceita).
