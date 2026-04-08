// Pure helpers for extension hygiene/unit tests. No vscode imports.
import * as fs from 'fs';

export interface OutputExtensionChoice {
  label: string;
  primaryExtension: string;
  acceptedExtensions: string[];
  description?: string;
}

export function normalizeExtension(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim().replace(/^\.+/, '').toLowerCase();
  return normalizedValue ? normalizedValue : undefined;
}

export function getCommonOutputExtensionChoices(): OutputExtensionChoice[] {
  return [
    { label: '.xml', primaryExtension: 'xml', acceptedExtensions: ['xml'] },
    { label: '.html', primaryExtension: 'html', acceptedExtensions: ['html', 'htm'], description: 'Accepts .html or .htm' },
    { label: '.xhtml', primaryExtension: 'xhtml', acceptedExtensions: ['xhtml'] },
    { label: '.txt', primaryExtension: 'txt', acceptedExtensions: ['txt', 'text'], description: 'Accepts .txt or .text' },
    { label: '.fo', primaryExtension: 'fo', acceptedExtensions: ['fo'] },
    { label: '.json', primaryExtension: 'json', acceptedExtensions: ['json'] }
  ];
}

export function buildOutputExtensionReminder(choice: OutputExtensionChoice): string {
  if (choice.acceptedExtensions.length === 1) {
    return `Using .${choice.primaryExtension} as the suggested extension for this transform output.`;
  }
  return `Using .${choice.primaryExtension} as the suggested extension for this transform output. Equivalent extensions: ${choice.acceptedExtensions.map(e => `.${e}`).join(', ')}.`;
}

export function extractRootNamespace(xmlContent: string): string | undefined {
  const rootElementMatch = xmlContent.match(/<([\w.-]+:)?([\w.-]+)\b([^>]*)>/i);
  if (!rootElementMatch) return undefined;
  const attributes = rootElementMatch[3] ?? '';
  const namespaceMatch = attributes.match(/\bxmlns\s*=\s*(["'])([^"']+)\1/i);
  return namespaceMatch?.[2]?.trim();
}

export function detectXmlDocumentFamily(source: { fsPath: string }): string | undefined {
  try {
    const sourceContent = fs.readFileSync(source.fsPath, 'utf8');
    const rootNamespace = extractRootNamespace(sourceContent);
    if (rootNamespace === 'http://www.tei-c.org/ns/1.0') return 'TEI';
    if (rootNamespace === 'http://docbook.org/ns/docbook') return 'DocBook';
  } catch {
    return undefined;
  }
  return undefined;
}
