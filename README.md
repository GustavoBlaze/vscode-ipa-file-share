# IPA File Share 📱🚀
IPA File Share is a VS Code and Cursor extension designed to streamline the installation of .ipa files on iPhones. It eliminates the need for external services like Diawi by turning your local machine into a secure Over-the-Air (OTA) distribution server using an HTTPS tunnel.

### ✨ Features
- OTA (Over-the-Air) Installation: Generate a QR Code and install apps directly via the iOS camera.

- Global Access: Thanks to ngrok, your phone does not need to be on the same network as your computer. You can install your build from anywhere with internet access.

- Automatic Metadata Extraction: Automatically parses the Info.plist inside your IPA to retrieve the Bundle ID, version, and app name.

- Temporary Secure Tunnel: Uses ngrok to provide a valid HTTPS connection (required by iOS).

- Auto-Cleanup: The server and the tunnel are automatically destroyed as soon as you close the QR Code tab in the editor.

### 🛠️ Prerequisites
- ngrok Authtoken: You need a free account at ngrok to enable tunneling.

- Signed IPA: Ensure your .ipa is signed with a valid Development or Ad Hoc profile (e.g., generated via eas build --local).

## How to use

### Run from source

1. Open this repository in **VS Code** or **Cursor**.
2. Run `npm install`.
3. Press **F5** to start the **Extension Development Host**.

### Token configuration

1. Open **Settings** (**⌘ + ,** on macOS, **Ctrl + ,** on Windows/Linux).
2. Search for **IPA File Share Config** (or `ipaFileShare`).
3. Paste your [ngrok authtoken](https://dashboard.ngrok.com/get-started/your-authtoken).

### Installation flow

1. Right-click a `.ipa` in the **Explorer**.
2. Select **IPA File Share**.
3. On your iPhone, scan the QR code and follow the system prompts.

> **Note:** When you are finished, **close the QR code tab** in the editor. That stops the local server and the ngrok tunnel.

## Project structure

| File | What it is |
| --- | --- |
| `src/extension.ts` | Main logic, Express server, and ngrok tunnel lifecycle. |
| `package.json` | Commands, context menu, and extension settings. |

## Security & privacy

The extension sends the `ngrok-skip-browser-warning` header so the iOS installer can load the manifest without an extra click through ngrok’s browser page. The tunnel is **ephemeral**: it only runs while the QR/webview tab from this command is open, so your build is not left exposed after you are done.

> **Tip:** Pairs well with `eas build --local` so you can install on a physical device in seconds without uploading the IPA to a third-party host.