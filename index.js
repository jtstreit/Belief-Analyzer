// Expo's Android embed command resolves entries from the pnpm workspace root.
// Forward to the app-local entry so native release builds work in the monorepo.
import "./artifacts/rebt-app/index";
