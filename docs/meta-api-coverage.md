# Meta WhatsApp Cloud API — Coverage Notes

Current Graph API version default: **v26.0** (`WA_BUSINESS_VERSION`).

## Implemented in Evolution API

| Capability | Evolution endpoint | Meta Graph API |
|---|---|---|
| List templates | `GET /template/find/:instanceName` | `GET /{waba-id}/message_templates` |
| Create template | `POST /template/create/:instanceName` | `POST /{waba-id}/message_templates` |
| Edit template | `POST /template/edit/:instanceName` | `POST /{template-id}` |
| Delete template | `DELETE /template/delete/:instanceName` | `DELETE /{waba-id}/message_templates` |
| Get template by id | `GET /template/findById/:instanceName?templateId=` | `GET /{template-id}` |
| Get template status | `GET /template/status/:instanceName?templateId=` | `GET /{template-id}?fields=status,...` |
| Send template message | `POST /message/sendTemplate/:instanceName` | `POST /{phone-number-id}/messages` |
| Template webhooks | inbound `/webhook/meta` → event fan-out | `message_template_status_update`, quality/category/components updates |

## Suggested Meta endpoints still missing (candidates to add)

1. **Template Library browse** — `GET /message_template_library` (search pre-approved library templates before create).
2. **Namespace / migration** — WABA namespace retrieval and template migration between WABAs.
3. **Conversational automation / flows** — WhatsApp Flows endpoints (`/{flow-id}`, flow assets, publishing).
4. **Marketing Messages API / MM Lite** — dedicated marketing send + insights endpoints beyond classic Cloud API `messages`.
5. **Template analytics** — template performance insights (`template_analytics`).
6. **Phone number / WABA management** — register/deregister numbers, two-step verification, commerce settings beyond profile update.
7. **Block users / messaging limits** — block/unblock APIs and messaging limit tier retrieval.
8. **Media resumable upload session** — explicit resumable upload create/complete helpers (partially covered by current media helpers).
9. **Official business account / review** — OBA submission and review status.
10. **QR code messages / deep links** — pre-filled message QR management APIs.

If you want, next iteration can prioritize Template Library + template analytics because they complement the new Templates Manager UI.
