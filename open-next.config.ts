import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Sin caché incremental: todas las pantallas dependen de la sesión (son dinámicas).
export default defineCloudflareConfig();
