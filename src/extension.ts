import * as vscode from 'vscode';
import express from 'express';
import * as ngrok from '@ngrok/ngrok';
import AdmZip from 'adm-zip';
import * as plist from 'plist';
import * as QRCode from 'qrcode';
import { Server } from 'http';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('ipa-file-share.start', async (uri: vscode.Uri) => {
        if (!uri || !uri.fsPath.endsWith('.ipa')) {
            vscode.window.showErrorMessage('Selecione um arquivo .ipa válido.');
            return;
        }

        const config = vscode.workspace.getConfiguration('ipaFileShare');
        const token = config.get<string>('ngrokToken');

        if (!token) {
            const setup = 'Configurar Token';
            const selection = await vscode.window.showErrorMessage('Token do ngrok não configurado.', setup);
            if (selection === setup) {
                vscode.commands.executeCommand('workbench.action.openSettings', 'ipaFileShare.ngrokToken');
            }
            return;
        }

        try {
            // 1. Extrair Metadados
            const metadata = await extractIpaMetadata(uri.fsPath);
            
            // 2. Iniciar Servidor Express
            const app = express();
            let publicUrl = '';

            app.get('/download/app.ipa', (req, res) => {
                res.setHeader('ngrok-skip-browser-warning', 'true');
                res.download(uri.fsPath, 'app.ipa');
            });

            app.get('/manifest.plist', (req, res) => {
                const manifest = generateManifest(publicUrl, metadata);
                res.setHeader('ngrok-skip-browser-warning', 'true');
                res.set('Content-Type', 'text/xml');
                res.send(manifest);
            });

            app.get('/install', (_req, res) => {
                const base = publicUrl.replace(/\/$/, '');
                const manifestHttpsUrl = `${base}/manifest.plist`;
                const itmsUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestHttpsUrl)}`;
                res.setHeader('ngrok-skip-browser-warning', 'true');
                res.set('Content-Type', 'text/html; charset=utf-8');
                res.send(otaInstallLandingHtml(metadata, base, itmsUrl));
            });

            const server: Server = app.listen(0);
            const localAddr = server.address();
            const port = typeof localAddr === 'object' && localAddr !== null ? localAddr.port : undefined;
            if (port === undefined) {
                server.close();
                throw new Error('Não foi possível obter a porta do servidor local.');
            }

            // 3. Túnel ngrok → Express já em escuta (listenAndServe chama listen() de novo no mesmo Server e falha)
            const session = await new ngrok.SessionBuilder().authtoken(token).connect();
            const tunnel = await session.httpEndpoint().listenAndForward(`http://127.0.0.1:${port}`);
            publicUrl = tunnel.url() || '';

            // 4. Criar Webview com QR Code
            const panel = vscode.window.createWebviewPanel(
                'ipaFileShare',
                `Instalar ${metadata.name}`,
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            const installPageUrl = `${publicUrl.replace(/\/$/, '')}/install`;
            const qrCodeDataUrl = await QRCode.toDataURL(installPageUrl);
            panel.webview.html = getWebviewContent(metadata, qrCodeDataUrl, publicUrl, installPageUrl);

            // 5. Cleanup ao fechar a aba
            panel.onDidDispose(() => {
                tunnel.close();
                session.close();
                server.close();
                vscode.window.showInformationMessage('Servidor de IPA e túnel encerrados.');
            }, null, context.subscriptions);

        } catch (error: any) {
            vscode.window.showErrorMessage(`Erro: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

async function extractIpaMetadata(ipaPath: string) {
    const zip = new AdmZip(ipaPath);
    const entries = zip.getEntries();
    const infoPlistEntry = entries.find(e => e.entryName.includes('.app/Info.plist'));

    if (!infoPlistEntry) {throw new Error('Info.plist não encontrado.');}
    
    const content = infoPlistEntry.getData();
    const data: any = plist.parse(content.toString());

    return {
        id: data.CFBundleIdentifier,
        version: data.CFBundleShortVersionString,
        name: data.CFBundleDisplayName || data.CFBundleName
    };
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Página aberta pelo QR; CTA usa itms-services com URL HTTPS do manifest (exigido pela Apple). */
function otaInstallLandingHtml(meta: { name: string; version: string; id: string }, publicBaseUrl: string, itmsUrl: string): string {
    const title = escapeHtml(meta.name);
    const version = escapeHtml(String(meta.version ?? ''));
    const id = escapeHtml(String(meta.id ?? ''));
    const href = escapeHtml(itmsUrl);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 1.25rem; max-width: 28rem; margin-inline: auto; }
    h1 { font-size: 1.35rem; margin: 0 0 0.5rem; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; word-break: break-all; }
    .cta {
      display: block; text-align: center; text-decoration: none;
      background: #007aff; color: #fff !important; font-weight: 600;
      padding: 0.95rem 1rem; border-radius: 12px; font-size: 1.05rem;
    }
    .cta:active { opacity: 0.85; }
    .hint { margin-top: 1.25rem; font-size: 0.8rem; color: #888; line-height: 1.4; }
    .url { font-size: 0.75rem; color: #aaa; margin-top: 1.5rem; word-break: break-all; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Versão ${version}<br /><span style="opacity:.85">${id}</span></p>
  <a class="cta" href="${href}">Instalar no iPhone</a>
  <p class="hint">Abra esta página no <strong>Safari</strong> e toque no botão. Na primeira vez pode ser preciso confiar no perfil em Ajustes → Geral → VPN e Gerenciamento de Dispositivo.</p>
  <p class="url">${escapeHtml(publicBaseUrl)}</p>
</body>
</html>`;
}

function generateManifest(url: string, meta: any) {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
    <dict>
        <key>items</key>
        <array>
            <dict>
                <key>assets</key>
                <array>
                    <dict>
                        <key>kind</key>
                        <string>software-package</string>
                        <key>url</key>
                        <string>${url}/download/app.ipa</string>
                    </dict>
                </array>
                <key>metadata</key>
                <dict>
                    <key>bundle-identifier</key>
                    <string>${meta.id}</string>
                    <key>bundle-version</key>
                    <string>${meta.version}</string>
                    <key>kind</key>
                    <string>software</string>
                    <key>title</key>
                    <string>${meta.name}</string>
                </dict>
            </dict>
        </array>
    </dict>
    </plist>`;
}

function getWebviewContent(meta: any, qr: string, tunnelUrl: string, installPageUrl: string) {
    return `<html>
        <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
            <h2>${escapeHtml(meta.name)}</h2>
            <p>Versão: ${escapeHtml(String(meta.version))} (${escapeHtml(String(meta.id))})</p>
            <img src="${qr}" style="width:250px; border: 10px solid white; border-radius:10px;" />
            <p style="margin-top:20px; color:gray; max-width:320px; text-align:center;">O QR abre uma página no iPhone; nela, toque em <strong>Instalar no iPhone</strong> para iniciar o download OTA.</p>
            <p style="font-size:11px; color:#888; max-width:360px; word-break:break-all;">${escapeHtml(installPageUrl)}</p>
            <p style="font-size:10px; color:silver;">Tunnel: ${escapeHtml(tunnelUrl)}</p>
        </body>
    </html>`;
}