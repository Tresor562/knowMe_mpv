'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const plugin = require('./with-animated-chat-media.cjs');

test('native chat media build enables GIF, WebP and animated WebP decoders', () => {
  assert.deepEqual(plugin.enabledProperties, [
    ['expo.gif.enabled', 'true'],
    ['expo.webp.enabled', 'true'],
    ['expo.webp.animated', 'true']
  ]);
  let props = [
    { type: 'comment', value: '# user preference' },
    { type: 'property', key: 'expo.webp.animated', value: 'false' },
    { type: 'property', key: 'expo.gif.enabled', value: 'false' }
  ];
  for (const [key, value] of plugin.enabledProperties) {
    props = plugin.upsertProperty(props, key, value);
  }
  assert.equal(props.filter(p => p.type === 'comment').length, 1);
  for (const [key, value] of plugin.enabledProperties) {
    assert.deepEqual(
      props.filter(p => p.type === 'property' && p.key === key).map(p => p.value),
      [value]
    );
  }
  const snapshot = JSON.stringify(props);
  for (const [key, value] of plugin.enabledProperties) {
    props = plugin.upsertProperty(props, key, value);
  }
  assert.equal(JSON.stringify(props), snapshot);
});
