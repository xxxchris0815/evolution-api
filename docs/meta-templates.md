# Meta WhatsApp Cloud API — Message Templates

English documentation for Evolution API Meta/WhatsApp Business template management.

Default Graph API version: **v26.0** (`WA_BUSINESS_VERSION`).

## Requirements

- Instance integration: `WHATSAPP-BUSINESS`
- Instance fields: `token` (Meta access token), `businessId` (WABA ID), `number` (phone number ID)
- Authentication header: `apikey`

## REST endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/template/find/:instanceName` | List templates from Meta |
| `GET` | `/template/findById/:instanceName?templateId=` | Get one template by Meta ID |
| `GET` | `/template/status/:instanceName?templateId=` | Get template status/quality fields |
| `POST` | `/template/create/:instanceName` | Create a template |
| `POST` | `/template/edit/:instanceName` | Edit an existing template |
| `DELETE` | `/template/delete/:instanceName` | Delete a template by name/`hsmId` |
| `POST` | `/message/sendTemplate/:instanceName` | Send an approved template message |

### List templates — query params

- `status` — e.g. `APPROVED`, `PENDING`, `REJECTED`, `PAUSED`, `DISABLED`
- `limit` — page size
- `after` / `before` — pagination cursors
- `name`, `language`, `category`
- `fields` — Meta field selection

### Create body example

```json
{
  "name": "order_update",
  "category": "UTILITY",
  "allowCategoryChange": true,
  "language": "en_US",
  "components": [
    {
      "type": "BODY",
      "text": "Hello {{1}}, your order {{2}} is ready."
    }
  ],
  "webhookUrl": "https://example.com/template-status"
}
```

Optional create fields:

- `parameterFormat`: `POSITIONAL` | `NAMED`
- `libraryTemplateName`
- `libraryTemplateButtonInputs`

### Find by ID / status examples

```bash
curl -H "apikey: YOUR_KEY" \
  "http://localhost:8080/template/findById/my-instance?templateId=123456789"

curl -H "apikey: YOUR_KEY" \
  "http://localhost:8080/template/status/my-instance?templateId=123456789"
```

## Inbound Meta webhooks

Endpoint: `GET|POST /webhook/meta`

Handled template fields:

- `message_template_status_update`
- `message_template_quality_update`
- `template_category_update`
- `message_template_components_update`

Behavior:

1. Updates local Prisma `Template` JSON metadata when a matching record exists
2. Optionally forwards to the per-template `webhookUrl` saved at create time
3. Emits Evolution events through webhook / websocket / RabbitMQ / SQS / NATS / Kafka / Pusher

## Evolution events

| Event constant | Wire value |
|---|---|
| `TEMPLATE_STATUS_UPDATE` | `template.status.update` |
| `TEMPLATE_QUALITY_UPDATE` | `template.quality.update` |
| `TEMPLATE_CATEGORY_UPDATE` | `template.category.update` |
| `TEMPLATE_COMPONENTS_UPDATE` | `template.components.update` |

Enable globally via env, for example:

```env
WA_BUSINESS_VERSION=v26.0
WEBHOOK_EVENTS_TEMPLATE_STATUS_UPDATE=true
WEBHOOK_EVENTS_TEMPLATE_QUALITY_UPDATE=true
WEBHOOK_EVENTS_TEMPLATE_CATEGORY_UPDATE=true
WEBHOOK_EVENTS_TEMPLATE_COMPONENTS_UPDATE=true
```

## Manager UI

Path: `/manager/instance/:instanceId/templates`

Visible only for instances with integration `WHATSAPP-BUSINESS`.

Supports:

- list + status filter
- create template (body/footer)
- delete template

## Tests

```bash
npm test
```

Covers:

- template controller delegation
- Graph URL/version + list filters
- Meta template webhook persistence + event emit
- event registry registration

## Optional Meta webhook passthrough (raw Meta schema)

By default Evolution normalizes only selected Meta fields (`messages`, template lifecycle).
You can also forward **any** Meta WABA webhook field using Meta's native schema.

### Manager UI (recommended)

For `WHATSAPP-BUSINESS` instances, open **Templates** in the Manager:

1. Copy **Standard callback URL** (`/webhook/meta`) or **Passthrough callback URL** (`/webhook/meta/passthrough`)
2. Copy the **Verify token** into Meta App Dashboard
3. Optionally enable **passthrough on the standard endpoint** (per instance)
4. Activate the **META_WEBHOOK** event and set your Evolution outbound webhook URL

API used by the UI:

- `GET /template/metaWebhook/:instanceName`
- `POST /template/metaWebhook/:instanceName`

Body example:

```json
{
  "passthroughEnabled": true,
  "enableMetaWebhookEvent": true,
  "webhookUrl": "https://your-server.com/webhook",
  "webhookEnabled": true
}
```

### Option A — dedicated endpoint

Configure Meta's callback URL to:

```text
https://YOUR_EVOLUTION_HOST/webhook/meta/passthrough
```

Behavior:

- accepts all Meta `whatsapp_business_account` webhook fields
- preserves Meta payload shape (`object` + `entry` + `changes`)
- resolves instance by `phone_number_id` or WABA/`businessId`
- emits Evolution event `META_WEBHOOK` (`meta.webhook`) to the configured webhook/queues

### Option B — sidecar on standard endpoint

Keep Meta pointing to `/webhook/meta` and enable either:

```env
WA_BUSINESS_WEBHOOK_PASSTHROUGH=true
WEBHOOK_EVENTS_META_WEBHOOK=true
```

or per-instance `Setting.metaWebhookPassthrough=true` (Manager Templates page / `POST /template/metaWebhook`).

Then `/webhook/meta` continues normal processing **and** also emits raw `meta.webhook` events for eligible instances.

### Consumer payload shape

```json
{
  "event": "meta.webhook",
  "instance": "my-instance",
  "data": {
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "WABA_ID",
        "changes": [
          {
            "field": "account_update",
            "value": { }
          }
        ]
      }
    ],
    "_evolution": {
      "mode": "dedicated",
      "field": "account_update",
      "wabaId": "WABA_ID",
      "receivedAt": "2026-08-11T20:00:00.000Z"
    }
  }
}
```

Enable the event in instance webhook settings (`META_WEBHOOK`), via the Manager Templates Meta webhook panel, or globally via env.

## Related

- Coverage gaps / suggested next Meta endpoints: [meta-api-coverage.md](./meta-api-coverage.md)
