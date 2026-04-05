import test from 'node:test';
import assert from 'node:assert/strict';

import { appendSingleSelectionHero } from '../ui/property_panel_selection_hero_renderer.js';

class FakeElement {
  constructor(ownerDocument, tagName = 'div') {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.textContent = '';
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(this, tagName);
  }
}

test('swatch uses effective-color swatch when available', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendSingleSelectionHero(doc, element, { color: '#00ff00' }, [
    { key: 'effective-color', swatch: '#ff0000' },
  ]);

  const hero = element.children[0];
  const swatch = hero.children[0];
  assert.equal(swatch.className, 'cad-selection-hero__swatch');
  assert.equal(swatch.dataset.selectionColor, '#ff0000');
  assert.equal(swatch.style.background, '#ff0000');
});

test('swatch falls back to primary.color when effective-color swatch is missing', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendSingleSelectionHero(doc, element, { color: '#00ff00' }, [
    { key: 'effective-color', value: '#ff0000' },
  ]);

  const swatch = element.children[0].children[0];
  assert.equal(swatch.dataset.selectionColor, '#00ff00');
  assert.equal(swatch.style.background, '#00ff00');
});

test('swatch falls back to #ffffff when both swatch and primary.color are absent', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendSingleSelectionHero(doc, element, {}, []);

  const swatch = element.children[0].children[0];
  assert.equal(swatch.dataset.selectionColor, '#ffffff');
  assert.equal(swatch.style.background, '#ffffff');
});

test('swatch falls back to #ffffff when primary.color is empty string', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendSingleSelectionHero(doc, element, { color: '  ' }, []);

  const swatch = element.children[0].children[0];
  assert.equal(swatch.dataset.selectionColor, '#ffffff');
});

test('title renders primary.type', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendSingleSelectionHero(doc, element, { type: 'circle' }, []);

  const heroText = element.children[0].children[1];
  const title = heroText.children[0];
  assert.equal(title.className, 'cad-selection-hero__title');
  assert.equal(title.dataset.selectionField, 'type');
  assert.equal(title.textContent, 'circle');
});

test('title falls back to entity when type is missing', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendSingleSelectionHero(doc, element, {}, []);

  const title = element.children[0].children[1].children[0];
  assert.equal(title.textContent, 'entity');
});

test('origin caption renders when sourceType and proxyKind are present', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendSingleSelectionHero(doc, element, { sourceType: 'INSERT', proxyKind: 'fragment' }, []);

  const heroText = element.children[0].children[1];
  assert.equal(heroText.children.length, 2);
  const subtitle = heroText.children[1];
  assert.equal(subtitle.className, 'cad-selection-hero__subtitle');
  assert.equal(subtitle.dataset.selectionField, 'origin-caption');
  assert.equal(subtitle.textContent, 'INSERT / fragment');
});

test('no caption element when origin is empty', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendSingleSelectionHero(doc, element, { type: 'line' }, []);

  const heroText = element.children[0].children[1];
  assert.equal(heroText.children.length, 1);
});

test('hero DOM structure and append order', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendSingleSelectionHero(doc, element, { type: 'arc', sourceType: 'XREF' }, [
    { key: 'effective-color', swatch: '#abc123' },
  ]);

  assert.equal(element.children.length, 1);
  const hero = element.children[0];
  assert.equal(hero.className, 'cad-selection-hero');
  assert.equal(hero.children.length, 2);
  assert.equal(hero.children[0].className, 'cad-selection-hero__swatch');
  assert.equal(hero.children[0].dataset.selectionField, 'effective-color-swatch');
  assert.equal(hero.children[1].className, 'cad-selection-hero__text');
});
