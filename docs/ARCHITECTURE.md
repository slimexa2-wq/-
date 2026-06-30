# Architecture

The iPad version keeps the upstream web interface and replaces the Electron shell with Capacitor.

The upstream public folder is copied into www. Mobile styles and a browser bridge are added before Capacitor packages the result for iOS.

The Node service remains separate during the first milestone.

Desktop-only features are intentionally disabled in this phase.
