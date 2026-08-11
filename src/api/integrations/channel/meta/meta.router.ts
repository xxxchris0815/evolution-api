import { RouterBroker } from '@api/abstract/abstract.router';
import { metaController } from '@api/server.module';
import { ConfigService, WaBusiness } from '@config/env.config';
import { Router } from 'express';

/**
 * Meta Cloud API inbound webhooks.
 *
 * - GET/POST /webhook/meta
 *   Standard Evolution processing (messages + template lifecycle).
 *   Optional raw passthrough sidecar when WA_BUSINESS_WEBHOOK_PASSTHROUGH=true.
 *
 * - GET/POST /webhook/meta/passthrough
 *   Dedicated endpoint that forwards Meta payloads using Meta's native schema
 *   to the configured Evolution webhook as event META_WEBHOOK (`meta.webhook`).
 */
export class MetaRouter extends RouterBroker {
  constructor(readonly configService: ConfigService) {
    super();

    const verify = (req, res) => {
      if (req.query['hub.verify_token'] === configService.get<WaBusiness>('WA_BUSINESS').TOKEN_WEBHOOK) {
        res.send(req.query['hub.challenge']);
      } else {
        res.send('Error, wrong validation token');
      }
    };

    this.router
      .get(this.routerPath('webhook/meta', false), verify)
      .post(this.routerPath('webhook/meta', false), async (req, res) => {
        const response = await metaController.receiveWebhook(req.body);
        return res.status(200).json(response);
      })
      .get(this.routerPath('webhook/meta/passthrough', false), verify)
      .post(this.routerPath('webhook/meta/passthrough', false), async (req, res) => {
        const response = await metaController.receiveWebhookPassthrough(req.body);
        return res.status(200).json(response);
      });
  }

  public readonly router: Router = Router();
}
