import * as assert from 'assert';
// Import helpers from the extension file
import {
  normalizeExtension,
  getCommonOutputExtensionChoices,
  buildOutputExtensionReminder,
  extractRootNamespace,
  detectXmlDocumentFamily
} from '../src/hygiene-helpers';

describe('Extension Hygiene Helpers', () => {
  describe('normalizeExtension', () => {
    it('removes leading dots and lowercases', () => {
      assert.strictEqual(normalizeExtension('.XML'), 'xml');
      assert.strictEqual(normalizeExtension('..HtMl'), 'html');
      assert.strictEqual(normalizeExtension('TXT'), 'txt');
    });
    it('returns undefined for empty or invalid', () => {
      assert.strictEqual(normalizeExtension(''), undefined);
      assert.strictEqual(normalizeExtension('.'), undefined);
      assert.strictEqual(normalizeExtension(undefined), undefined);
    });
  });

  describe('getCommonOutputExtensionChoices', () => {
    it('includes html/htm and txt/text aliases', () => {
      const choices = getCommonOutputExtensionChoices();
      const html = choices.find(c => c.primaryExtension === 'html');
      const txt = choices.find(c => c.primaryExtension === 'txt');
      assert.ok(html && html.acceptedExtensions.includes('htm'));
      assert.ok(txt && txt.acceptedExtensions.includes('text'));
    });
  });

  describe('buildOutputExtensionReminder', () => {
    it('shows only primary for single extension', () => {
      const msg = buildOutputExtensionReminder({
        label: '.xml', primaryExtension: 'xml', acceptedExtensions: ['xml']
      });
      assert.match(msg, /xml/);
      assert.doesNotMatch(msg, /Equivalent/);
    });
    it('shows all aliases for multi-extension', () => {
      const msg = buildOutputExtensionReminder({
        label: '.html', primaryExtension: 'html', acceptedExtensions: ['html', 'htm']
      });
      assert.match(msg, /html/);
      assert.match(msg, /htm/);
      assert.match(msg, /Equivalent/);
    });
  });

  describe('extractRootNamespace', () => {
    it('extracts TEI namespace', () => {
      const xml = '<TEI version="3.3.0" xmlns="http://www.tei-c.org/ns/1.0">';
      assert.strictEqual(extractRootNamespace(xml), 'http://www.tei-c.org/ns/1.0');
    });
    it('extracts DocBook namespace', () => {
      const xml = '<book xmlns="http://docbook.org/ns/docbook">';
      assert.strictEqual(extractRootNamespace(xml), 'http://docbook.org/ns/docbook');
    });
    it('returns undefined for no xmlns', () => {
      const xml = '<foo/>';
      assert.strictEqual(extractRootNamespace(xml), undefined);
    });
  });

  describe('detectXmlDocumentFamily', () => {
    it('returns TEI for TEI namespace', () => {
      // Simulate a file by mocking fs.readFileSync
      const fs = require('fs');
      const orig = fs.readFileSync;
      fs.readFileSync = () => '<TEI xmlns="http://www.tei-c.org/ns/1.0">';
      assert.strictEqual(detectXmlDocumentFamily({ fsPath: 'fake.xml' }), 'TEI');
      fs.readFileSync = orig;
    });
    it('returns DocBook for DocBook namespace', () => {
      const fs = require('fs');
      const orig = fs.readFileSync;
      fs.readFileSync = () => '<book xmlns="http://docbook.org/ns/docbook">';
      assert.strictEqual(detectXmlDocumentFamily({ fsPath: 'fake.xml' }), 'DocBook');
      fs.readFileSync = orig;
    });
    it('returns undefined for unknown', () => {
      const fs = require('fs');
      const orig = fs.readFileSync;
      fs.readFileSync = () => '<foo/>';
      assert.strictEqual(detectXmlDocumentFamily({ fsPath: 'fake.xml' }), undefined);
      fs.readFileSync = orig;
    });
  });
});
