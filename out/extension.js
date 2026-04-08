"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.xsltRunnerCommandIds = void 0;
exports.activate = activate;
exports.normalizeExtension = normalizeExtension;
exports.getCommonOutputExtensionChoices = getCommonOutputExtensionChoices;
exports.buildOutputExtensionReminder = buildOutputExtensionReminder;
exports.extractRootNamespace = extractRootNamespace;
exports.detectXmlDocumentFamily = detectXmlDocumentFamily;
const cp = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const configuredCommandId = 'xsltRunner.runWithConfiguredBackend';
const javaCommandId = 'xsltRunner.runWithJava';
const pandocCommandId = 'xsltRunner.runWithPandoc';
const setSaxonJarPathCommandId = 'xsltRunner.setSaxonJarPath';
exports.xsltRunnerCommandIds = [configuredCommandId, javaCommandId, pandocCommandId, setSaxonJarPathCommandId];
function activate(context) {
    const outputChannel = vscode.window.createOutputChannel('XSLT Runner');
    context.subscriptions.push(outputChannel);
    const statusBarItem = vscode.window.createStatusBarItem('status.xsltRunner.run', vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = configuredCommandId;
    statusBarItem.text = '$(file-code) XSLT Run';
    statusBarItem.tooltip = vscode.l10n.t('Run XSLT Runner Conversion');
    context.subscriptions.push(statusBarItem);
    const updateStatusBarVisibility = () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor?.document.uri.scheme === 'file') {
            statusBarItem.show();
        }
        else {
            statusBarItem.hide();
        }
    };
    updateStatusBarVisibility();
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => updateStatusBarVisibility()));
    context.subscriptions.push(vscode.commands.registerCommand(configuredCommandId, async () => {
        const config = getRunnerConfig();
        if (config.backend === 'java') {
            await runJavaTransformation(config, outputChannel);
        }
        else {
            await runPandocConversion(config, outputChannel);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand(javaCommandId, async () => {
        await runJavaTransformation(getRunnerConfig(), outputChannel);
    }));
    context.subscriptions.push(vscode.commands.registerCommand(pandocCommandId, async () => {
        await runPandocConversion(getRunnerConfig(), outputChannel);
    }));
    context.subscriptions.push(vscode.commands.registerCommand(setSaxonJarPathCommandId, async () => {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: vscode.l10n.t('Select Saxon JAR'),
            filters: { 'JAR Files': ['jar'] },
            title: vscode.l10n.t('Select Saxon JAR File')
        });
        if (!uris?.[0]) {
            return;
        }
        await vscode.workspace.getConfiguration('xsltRunner').update('java.saxonJarPath', uris[0].fsPath, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(vscode.l10n.t('Saxon JAR path set to: {0}', uris[0].fsPath));
    }));
}
function getRunnerConfig() {
    const config = vscode.workspace.getConfiguration('xsltRunner');
    const configuredJavaPath = config.get('java.path', '').trim();
    const configuredPandocPath = config.get('pandoc.path', '').trim();
    return {
        backend: config.get('backend', 'java'),
        javaPath: resolveJavaPath(configuredJavaPath),
        saxonJarPath: config.get('java.saxonJarPath', '').trim(),
        stylesheetDirectory: config.get('java.stylesheetDirectory', '').trim(),
        javaExtraArgs: config.get('java.extraArgs', []),
        pandocPath: resolvePandocPath(configuredPandocPath),
        pandocExtraPathEntries: config.get('pandoc.extraPathEntries', []),
        pandocFrom: config.get('pandoc.from', '').trim(),
        pandocTo: config.get('pandoc.to', 'html').trim(),
        pandocExtraArgs: config.get('pandoc.extraArgs', [])
    };
}
function resolveJavaPath(configuredJavaPath) {
    if (configuredJavaPath) {
        return configuredJavaPath;
    }
    const defaultCandidates = getDefaultJavaCandidates();
    const absoluteCandidate = defaultCandidates.find(candidate => path.isAbsolute(candidate) && fs.existsSync(candidate));
    if (absoluteCandidate) {
        return absoluteCandidate;
    }
    return defaultCandidates[defaultCandidates.length - 1];
}
function getDefaultJavaCandidates() {
    if (process.platform === 'darwin') {
        const homebrew = process.arch === 'arm64' ? '/opt/homebrew' : '/usr/local';
        return [
            `${homebrew}/opt/openjdk/bin/java`,
            `${homebrew}/opt/openjdk@21/bin/java`,
            `${homebrew}/opt/openjdk@17/bin/java`,
            '/usr/bin/java',
            'java'
        ];
    }
    if (process.platform === 'win32') {
        return ['java.exe'];
    }
    return ['/usr/bin/java', '/usr/local/bin/java', 'java'];
}
function resolvePandocPath(configuredPandocPath) {
    if (configuredPandocPath) {
        return configuredPandocPath;
    }
    const defaultCandidates = getDefaultPandocCandidates();
    const absoluteCandidate = defaultCandidates.find(candidate => path.isAbsolute(candidate) && fs.existsSync(candidate));
    if (absoluteCandidate) {
        return absoluteCandidate;
    }
    return defaultCandidates[defaultCandidates.length - 1];
}
function getDefaultPandocCandidates() {
    if (process.platform === 'darwin') {
        if (process.arch === 'arm64') {
            return ['/opt/homebrew/bin/pandoc', '/usr/local/bin/pandoc', 'pandoc'];
        }
        return ['/usr/local/bin/pandoc', '/opt/homebrew/bin/pandoc', 'pandoc'];
    }
    if (process.platform === 'win32') {
        return ['pandoc.exe'];
    }
    return ['/usr/bin/pandoc', '/usr/local/bin/pandoc', 'pandoc'];
}
async function runJavaTransformation(config, outputChannel) {
    const source = await pickSourceFile({
        placeHolder: vscode.l10n.t('Choose the XML input file to transform'),
        useActiveLabel: vscode.l10n.t('Use Active File as XML Input'),
        pickDifferentLabel: vscode.l10n.t('Choose a Different XML Input File'),
        openDialogTitle: vscode.l10n.t('Select XML Input File'),
        filters: {
            'XML Files': ['xml']
        }
    });
    if (!source) {
        return;
    }
    if (!config.saxonJarPath) {
        const openSettings = vscode.l10n.t('Open Settings');
        const selection = await vscode.window.showErrorMessage(vscode.l10n.t('Set xsltRunner.java.saxonJarPath before running Java XSLT conversions.'), openSettings);
        if (selection === openSettings) {
            await vscode.commands.executeCommand('workbench.action.openSettings', 'xsltRunner.java.saxonJarPath');
        }
        return;
    }
    const stylesheetDirectory = await resolveStylesheetDirectory(config.stylesheetDirectory);
    if (!stylesheetDirectory) {
        return;
    }
    const stylesheet = await pickFile(vscode.l10n.t('Select XSLT Stylesheet'), {
        'XSLT Stylesheet': ['xsl', 'xslt']
    }, stylesheetDirectory);
    if (!stylesheet) {
        return;
    }
    const sourceFamily = detectXmlDocumentFamily(source);
    const outputChoice = await pickJavaOutputExtension(sourceFamily);
    if (!outputChoice) {
        return;
    }
    const output = await pickOutputFile(source, `.transformed.${outputChoice.primaryExtension}`, buildOutputExtensionReminder(outputChoice));
    if (!output) {
        return;
    }
    const normalizedOutput = await confirmOutputExtension(output, outputChoice);
    if (!normalizedOutput) {
        return;
    }
    const args = [
        '-jar',
        config.saxonJarPath,
        `-s:${source.fsPath}`,
        `-xsl:${stylesheet.fsPath}`,
        `-o:${normalizedOutput.fsPath}`,
        ...config.javaExtraArgs
    ];
    await runExternalProcess(config.javaPath, args, source, outputChannel, vscode.l10n.t('Java XSLT transformation completed.'));
}
async function runPandocConversion(config, outputChannel) {
    const pandocPathEntries = resolvePandocExtraPathEntries(config.pandocExtraPathEntries);
    outputChannel.show(true);
    outputChannel.appendLine(`Using Pandoc executable: ${config.pandocPath}`);
    if (pandocPathEntries.length > 0) {
        outputChannel.appendLine(`Using PATH additions for Pandoc: ${pandocPathEntries.join(path.delimiter)}`);
    }
    const source = await pickSourceFile({
        placeHolder: vscode.l10n.t('Choose the source file for the Pandoc conversion'),
        useActiveLabel: vscode.l10n.t('Use Active File as Source'),
        pickDifferentLabel: vscode.l10n.t('Choose a Different Source File'),
        openDialogTitle: vscode.l10n.t('Select Source File for Pandoc')
    });
    if (!source) {
        return;
    }
    const targetFormat = await resolvePandocTargetFormat(config, source, outputChannel, pandocPathEntries);
    if (!targetFormat) {
        return;
    }
    const outputSuffix = `.${targetFormat}`;
    const output = await pickOutputFile(source, outputSuffix);
    if (!output) {
        return;
    }
    const args = [source.fsPath];
    if (config.pandocFrom) {
        args.push('--from', config.pandocFrom);
    }
    args.push('--to', targetFormat);
    args.push('--output', output.fsPath, ...config.pandocExtraArgs);
    await runExternalProcess(config.pandocPath, args, source, outputChannel, vscode.l10n.t('Pandoc conversion completed.'), pandocPathEntries);
}
async function pickSourceFile(options) {
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    if (activeUri?.scheme === 'file') {
        const useActive = await vscode.window.showQuickPick([
            { label: options.useActiveLabel, uri: activeUri },
            { label: options.pickDifferentLabel }
        ], {
            placeHolder: options.placeHolder,
            title: options.openDialogTitle
        });
        if (!useActive) {
            return undefined;
        }
        if (useActive.uri) {
            return useActive.uri;
        }
    }
    return pickFile(options.openDialogTitle ?? options.placeHolder, options.filters);
}
async function pickFile(placeHolder, filters, defaultUri) {
    const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: vscode.l10n.t('Select'),
        filters,
        defaultUri: defaultUri ?? getDefaultFolderUri(),
        title: placeHolder
    });
    return uris?.[0];
}
async function resolveStylesheetDirectory(configuredDirectory) {
    let configuredUri;
    if (configuredDirectory) {
        configuredUri = vscode.Uri.file(configuredDirectory);
    }
    const directoryUris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: vscode.l10n.t('Use Stylesheet Directory'),
        defaultUri: configuredUri ?? getDefaultFolderUri(),
        title: vscode.l10n.t('Select Stylesheet Directory')
    });
    if (!directoryUris?.[0]) {
        vscode.window.showErrorMessage(vscode.l10n.t('A stylesheet directory is required for Java XSLT conversions.'));
        return undefined;
    }
    return directoryUris[0];
}
async function resolvePandocTargetFormat(config, source, outputChannel, pandocPathEntries) {
    const supportedFormats = await getPandocOutputFormats(config.pandocPath, source, outputChannel, pandocPathEntries);
    if (!supportedFormats.length) {
        vscode.window.showErrorMessage(vscode.l10n.t('Could not resolve Pandoc output formats. Ensure Pandoc is installed and reachable.'));
        return undefined;
    }
    const defaultFormat = config.pandocTo && supportedFormats.includes(config.pandocTo) ? config.pandocTo : undefined;
    const selected = await vscode.window.showQuickPick(supportedFormats.map(format => ({
        label: format,
        description: format === defaultFormat ? vscode.l10n.t('default') : undefined
    })), {
        placeHolder: vscode.l10n.t('Select Pandoc Target Format')
    });
    if (!selected) {
        return undefined;
    }
    return selected.label;
}
async function getPandocOutputFormats(pandocPath, source, outputChannel, pandocPathEntries) {
    try {
        const { stdout } = await execFile(pandocPath, ['--list-output-formats'], {
            cwd: path.dirname(source.fsPath),
            env: buildExecEnv(pandocPathEntries),
            encoding: 'utf8',
            maxBuffer: 1024 * 1024
        });
        return stdout
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .sort((a, b) => a.localeCompare(b));
    }
    catch (error) {
        const processError = error;
        if (processError.stderr) {
            outputChannel.appendLine(processError.stderr.trimEnd());
        }
        return [];
    }
}
async function pickOutputFile(source, suffix, reminder) {
    const sourceFileName = path.basename(source.fsPath, path.extname(source.fsPath));
    const defaultOutputName = `${sourceFileName}${suffix}`;
    const defaultUri = vscode.Uri.file(path.join(path.dirname(source.fsPath), defaultOutputName));
    const title = reminder
        ? vscode.l10n.t('Select Output File. {0}', reminder)
        : vscode.l10n.t('Select Output File');
    return vscode.window.showSaveDialog({
        title,
        saveLabel: vscode.l10n.t('Save Output'),
        defaultUri,
        filters: {
            All: ['*']
        }
    });
}
async function pickJavaOutputExtension(sourceFamily) {
    const commonExtensions = getCommonOutputExtensionChoices();
    const selected = await vscode.window.showQuickPick([
        ...commonExtensions.map(choice => ({
            label: choice.label,
            description: choice.description,
            choice
        })),
        {
            label: vscode.l10n.t('Enter a Custom Extension'),
            choice: undefined
        }
    ], {
        placeHolder: vscode.l10n.t('Choose the file extension for the transformation result'),
        title: sourceFamily
            ? vscode.l10n.t('Detected source document family: {0}', sourceFamily)
            : undefined
    });
    if (!selected) {
        return undefined;
    }
    if (selected.choice) {
        return selected.choice;
    }
    const customExtension = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter the output file extension without the leading dot'),
        placeHolder: vscode.l10n.t('Examples: html, htm, xhtml, fo, xml'),
        value: 'xml',
        validateInput: value => {
            const normalizedValue = normalizeExtension(value);
            if (!normalizedValue) {
                return vscode.l10n.t('Enter at least one letter or number for the file extension.');
            }
            if (!/^[a-z0-9][a-z0-9._-]*$/i.test(normalizedValue)) {
                return vscode.l10n.t('Use only letters, numbers, dots, hyphens, or underscores.');
            }
            return undefined;
        }
    });
    const normalizedExtension = normalizeExtension(customExtension);
    if (!normalizedExtension) {
        return undefined;
    }
    return {
        label: `.${normalizedExtension}`,
        primaryExtension: normalizedExtension,
        acceptedExtensions: [normalizedExtension]
    };
}
function getCommonOutputExtensionChoices() {
    return [
        {
            label: '.xml',
            primaryExtension: 'xml',
            acceptedExtensions: ['xml']
        },
        {
            label: '.html',
            primaryExtension: 'html',
            acceptedExtensions: ['html', 'htm'],
            description: vscode.l10n.t('Accepts .html or .htm')
        },
        {
            label: '.xhtml',
            primaryExtension: 'xhtml',
            acceptedExtensions: ['xhtml']
        },
        {
            label: '.txt',
            primaryExtension: 'txt',
            acceptedExtensions: ['txt', 'text'],
            description: vscode.l10n.t('Accepts .txt or .text')
        },
        {
            label: '.fo',
            primaryExtension: 'fo',
            acceptedExtensions: ['fo']
        },
        {
            label: '.json',
            primaryExtension: 'json',
            acceptedExtensions: ['json']
        }
    ];
}
function buildOutputExtensionReminder(choice) {
    if (choice.acceptedExtensions.length === 1) {
        return vscode.l10n.t('Using .{0} as the suggested extension for this transform output.', choice.primaryExtension);
    }
    return vscode.l10n.t('Using .{0} as the suggested extension for this transform output. Equivalent extensions: {1}.', choice.primaryExtension, choice.acceptedExtensions.map(extension => `.${extension}`).join(', '));
}
async function confirmOutputExtension(output, choice) {
    const selectedExtension = normalizeExtension(path.extname(output.fsPath));
    if (selectedExtension && choice.acceptedExtensions.includes(selectedExtension)) {
        return output;
    }
    const preferredOutput = replaceFileExtension(output, choice.primaryExtension);
    const useSuggested = vscode.l10n.t('Use .{0}', choice.primaryExtension);
    const keepChosen = vscode.l10n.t('Keep Chosen Filename');
    const selection = await vscode.window.showWarningMessage(vscode.l10n.t('The selected filename does not match the chosen output extension. Expected {0}.', choice.acceptedExtensions.map(extension => `.${extension}`).join(' or ')), useSuggested, keepChosen);
    if (!selection) {
        return undefined;
    }
    if (selection === useSuggested) {
        return preferredOutput;
    }
    return output;
}
function replaceFileExtension(fileUri, extension) {
    const directory = path.dirname(fileUri.fsPath);
    const fileName = path.basename(fileUri.fsPath, path.extname(fileUri.fsPath));
    return vscode.Uri.file(path.join(directory, `${fileName}.${extension}`));
}
function detectXmlDocumentFamily(source) {
    try {
        const sourceContent = fs.readFileSync(source.fsPath, 'utf8');
        const rootNamespace = extractRootNamespace(sourceContent);
        if (rootNamespace === 'http://www.tei-c.org/ns/1.0') {
            return 'TEI';
        }
        if (rootNamespace === 'http://docbook.org/ns/docbook') {
            return 'DocBook';
        }
    }
    catch {
        return undefined;
    }
    return undefined;
}
function extractRootNamespace(xmlContent) {
    const rootElementMatch = xmlContent.match(/<([\w.-]+:)?([\w.-]+)\b([^>]*)>/i);
    if (!rootElementMatch) {
        return undefined;
    }
    const attributes = rootElementMatch[3] ?? '';
    const namespaceMatch = attributes.match(/\bxmlns\s*=\s*(["'])([^"']+)\1/i);
    return namespaceMatch?.[2]?.trim();
}
function normalizeExtension(value) {
    const normalizedValue = value?.trim().replace(/^\.+/, '').toLowerCase();
    return normalizedValue ? normalizedValue : undefined;
}
function getDefaultFolderUri() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri;
}
async function runExternalProcess(toolPath, args, source, outputChannel, successMessage, extraPathEntries = []) {
    outputChannel.show(true);
    outputChannel.appendLine(`$ ${toolPath} ${args.map(quoteArgument).join(' ')}`);
    try {
        const { stdout, stderr } = await execFile(toolPath, args, {
            cwd: path.dirname(source.fsPath),
            env: buildExecEnv(extraPathEntries),
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024
        });
        if (stdout) {
            outputChannel.appendLine(stdout.trimEnd());
        }
        if (stderr) {
            outputChannel.appendLine(stderr.trimEnd());
        }
        vscode.window.showInformationMessage(successMessage);
    }
    catch (error) {
        const processError = error;
        if (processError.stdout) {
            outputChannel.appendLine(processError.stdout.trimEnd());
        }
        if (processError.stderr) {
            outputChannel.appendLine(processError.stderr.trimEnd());
        }
        const message = processError.message || vscode.l10n.t('Conversion failed.');
        vscode.window.showErrorMessage(vscode.l10n.t('Conversion failed: {0}', message));
    }
}
function quoteArgument(value) {
    if (/\s/.test(value)) {
        return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
}
function resolvePandocExtraPathEntries(configuredEntries) {
    const trimmedConfiguredEntries = configuredEntries
        .map(entry => entry.trim())
        .filter(entry => entry.length > 0);
    const defaultEntries = getDefaultPandocExtraPathEntries();
    const candidateEntries = [...trimmedConfiguredEntries, ...defaultEntries];
    const seen = new Set();
    const resolved = [];
    for (const entry of candidateEntries) {
        if (!path.isAbsolute(entry) || !fs.existsSync(entry) || seen.has(entry)) {
            continue;
        }
        seen.add(entry);
        resolved.push(entry);
    }
    return resolved;
}
function getDefaultPandocExtraPathEntries() {
    if (process.platform === 'darwin') {
        return ['/Library/TeX/texbin', '/opt/homebrew/bin', '/usr/local/bin'];
    }
    if (process.platform === 'linux') {
        return ['/usr/local/bin', '/usr/bin'];
    }
    return [];
}
function buildExecEnv(extraPathEntries) {
    if (extraPathEntries.length === 0) {
        return process.env;
    }
    const env = { ...process.env };
    const pathKey = getPathEnvironmentKey(env);
    const existingPath = env[pathKey] ?? '';
    const pathSegments = existingPath
        .split(path.delimiter)
        .map(segment => segment.trim())
        .filter(segment => segment.length > 0);
    const merged = [...extraPathEntries, ...pathSegments];
    const deduped = [];
    const seen = new Set();
    for (const segment of merged) {
        if (seen.has(segment)) {
            continue;
        }
        seen.add(segment);
        deduped.push(segment);
    }
    env[pathKey] = deduped.join(path.delimiter);
    return env;
}
function getPathEnvironmentKey(env) {
    const existingPathKey = Object.keys(env).find(key => key.toLowerCase() === 'path');
    if (existingPathKey) {
        return existingPathKey;
    }
    return process.platform === 'win32' ? 'Path' : 'PATH';
}
function execFile(file, args, options) {
    return new Promise((resolve, reject) => {
        cp.execFile(file, args, options, (error, stdout, stderr) => {
            if (error) {
                const processError = error;
                processError.stdout = stdout;
                processError.stderr = stderr;
                reject(processError);
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}
