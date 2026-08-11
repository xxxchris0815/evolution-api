import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EventController } from '../../src/api/integrations/event/event.controller';
import { Events } from '../../src/api/types/wa.types';

describe('Template event registry (integration)', () => {
  it('registers template lifecycle events for webhook and queue fan-out', () => {
    assert.equal(Events.TEMPLATE_STATUS_UPDATE, 'template.status.update');
    assert.equal(Events.TEMPLATE_QUALITY_UPDATE, 'template.quality.update');
    assert.equal(Events.TEMPLATE_CATEGORY_UPDATE, 'template.category.update');
    assert.equal(Events.TEMPLATE_COMPONENTS_UPDATE, 'template.components.update');

    for (const eventName of [
      'TEMPLATE_STATUS_UPDATE',
      'TEMPLATE_QUALITY_UPDATE',
      'TEMPLATE_CATEGORY_UPDATE',
      'TEMPLATE_COMPONENTS_UPDATE',
    ]) {
      assert.ok(EventController.events.includes(eventName), `${eventName} missing from EventController.events`);
    }
  });
});
