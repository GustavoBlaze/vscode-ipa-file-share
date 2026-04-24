IPA File Share 📱🚀
IPA File Share is a VS Code and Cursor extension designed to streamline the installation of .ipa files on iPhones. It eliminates the need for external services like Diawi by turning your local machine into a secure Over-the-Air (OTA) distribution server using an HTTPS tunnel.

✨ Features
OTA (Over-the-Air) Installation: Generate a QR Code and install apps directly via the iOS camera.

Global Access: Thanks to ngrok, your phone does not need to be on the same network as your computer. You can install your build from anywhere with internet access.

Automatic Metadata Extraction: Automatically parses the Info.plist inside your IPA to retrieve the Bundle ID, version, and app name.

Temporary Secure Tunnel: Uses ngrok to provide a valid HTTPS connection (required by iOS).

Auto-Cleanup: The server and the tunnel are automatically destroyed as soon as you close the QR Code tab in the editor.

🛠️ Prerequisites
ngrok Authtoken: You need a free account at ngrok to enable tunneling.

Signed IPA: Ensure your .ipa is signed with a valid Development or Ad Hoc profile (e.g., generated via eas build --local).

🚀 How to Use
Installation:

Open the extension project in VS Code.

Run npm install to install dependencies.

Press F5 to launch the extension in development mode.

Token Configuration:

Go to Settings (Cmd + , or Ctrl + ,).

Search for IPA File Share Config.

Paste your ngrok Authtoken.

Installation Flow:

Right-click any .ipa file in the Explorer.

Select IPA File Share.

Scan the QR Code with your iPhone and follow the system prompts.

Note: Close the QR Code tab in VS Code once finished to shut down the server and tunnel.

📦 Project Structure
src/extension.ts: Main logic, Express server management, and ngrok tunnel lifecycle.

package.json: Command registration, context menus, and extension properties.

🛡️ Security & Privacy
The extension injects the ngrok-skip-browser-warning header to ensure the iOS installer can reach the manifest without manual interaction. The tunnel is ephemeral—it only stays open while the extension tab is active in your editor, ensuring your build isn't exposed longer than necessary.

Tip: This is the perfect companion for eas build --local workflows, allowing you to test physical device builds in seconds without uploading files to third-party servers.