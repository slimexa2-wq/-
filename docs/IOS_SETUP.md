# Install on iPad

Requirements: macOS, Xcode, Node.js 22 or newer, an Apple ID, an iPad with Developer Mode enabled, and a private HTTPS backend.

1. Clone the upstream Mineradio repository into the local .upstream/Mineradio directory.
2. Run npm install.
3. Run npm run mobile:prepare.
4. Run npm run cap:add:ios.
5. Run npm run cap:sync.
6. Run npm run ios:open.
7. In Xcode, select your Team, choose a unique bundle identifier, connect the iPad, and press Run.

The first milestone uses Safari Web Inspector to set the backend address through mineradioMobile.setBackendBaseUrl. A later milestone will provide an in-app settings screen.
