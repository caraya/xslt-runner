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
const cp = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const configuredCommandId = 'xsltRunner.runWithConfiguredBackend';
const javaCommandId = 'xsltRunner.runWithJava';
const pandocCommandId = 'xsltRunner.runWithPandoc';
exports.xsltRunnerCommandIds = [configuredCommandId, javaCommandId, pandocCommandId];
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
}
function getRunnerConfig() {
    const config = vscode.workspace.getConfiguration('xsltRunner');
    const configuredPandocPath = config.get('pandoc.path', '').trim();
    return {
        backend: config.get('backend', 'java'),
        javaPath: config.get('java.path', 'java'),
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
    const source = await pickSourceFile(vscode.l10n.t('Select XML Source File'));
    if (!source) {
        return;
    }
    if (!config.saxonJarPath) {
        vscode.window.showErrorMessage(vscode.l10n.t('Set xsltRunner.java.saxonJarPath before running Java XSLT conversions.'));
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
    const output = await pickOutputFile(source, '.transformed.xml');
    if (!output) {
        return;
    }
    const args = [
        '-jar',
        config.saxonJarPath,
        `-s:${source.fsPath}`,
        `-xsl:${stylesheet.fsPath}`,
        `-o:${output.fsPath}`,
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
    const source = await pickSourceFile(vscode.l10n.t('Select Source File for Pandoc'));
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
async function pickSourceFile(placeHolder) {
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    if (activeUri?.scheme === 'file') {
        const useActive = await vscode.window.showQuickPick([
            { label: vscode.l10n.t('Use Active File'), uri: activeUri },
            { label: vscode.l10n.t('Pick a Different File') }
        ], {
            placeHolder
        });
        if (!useActive) {
            return undefined;
        }
        if (useActive.uri) {
            return useActive.uri;
        }
    }
    return pickFile(placeHolder);
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
async function pickOutputFile(source, suffix) {
    const sourceFileName = path.basename(source.fsPath, path.extname(source.fsPath));
    const defaultOutputName = `${sourceFileName}${suffix}`;
    const defaultUri = vscode.Uri.file(path.join(path.dirname(source.fsPath), defaultOutputName));
    return vscode.window.showSaveDialog({
        title: vscode.l10n.t('Select Output File'),
        saveLabel: vscode.l10n.t('Save Output'),
        defaultUri,
        filters: {
            All: ['*']
        }
    });
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
