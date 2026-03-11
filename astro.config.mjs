import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isUserOrOrgPages = repository.endsWith(".github.io");
const base =
  process.env.GITHUB_ACTIONS && repository && !isUserOrOrgPages
    ? `/${repository}`
    : "/";
const site = process.env.GITHUB_REPOSITORY_OWNER
  ? `https://${process.env.GITHUB_REPOSITORY_OWNER}.github.io/docs`
  : undefined;

const config = {
  base,
  integrations: [
    starlight({
      title: "Thunder",
      description:
        "Rust-powered edge runtime built on the Deno stack. Execute JavaScript and TypeScript functions in isolated V8 sandboxes.",
      logo: {
        src: "./src/assets/logo.svg",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/thunder-edge/docs",
        },
      ],
      customCss: ["./src/styles/custom.css"],
      editLink: {
        baseUrl:
          "https://github.com/thunder-edge/docs/edit/main/",
      },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Overview", slug: "getting-started/overview" },
            { label: "Quick Start", slug: "getting-started/quick-start" },
            { label: "Key Concepts", slug: "getting-started/concepts" },
          ],
        },
        {
          label: "Installation",
          items: [
            { label: "Prerequisites", slug: "installation/prerequisites" },
            { label: "Install Thunder", slug: "installation/install" },
            { label: "Build from Source", slug: "installation/build-from-source" },
          ],
        },
        {
          label: "Core Concepts",
          items: [
            { label: "Edge Functions", slug: "concepts/edge-functions" },
            { label: "Isolate Sandbox", slug: "concepts/isolate-sandbox" },
            { label: "Function Lifecycle", slug: "concepts/function-lifecycle" },
            { label: "Dual-Listener Architecture", slug: "concepts/dual-listener" },
            { label: "Bundling", slug: "concepts/bundling" },
          ],
        },
        {
          label: "Architecture",
          items: [
            { label: "System Overview", slug: "architecture/system-overview" },
            { label: "Crate Structure", slug: "architecture/crate-structure" },
            { label: "Request Flow", slug: "architecture/request-flow" },
            { label: "Security Model", slug: "architecture/security-model" },
          ],
        },
        {
          label: "Guides",
          items: [
            {
              label: "Your First Function",
              slug: "guides/your-first-function",
            },
            { label: "RESTful APIs", slug: "guides/restful-apis" },
            { label: "Streaming & SSE", slug: "guides/streaming-sse" },
            { label: "Testing Functions", slug: "guides/testing" },
            { label: "Debugging", slug: "guides/debugging" },
            { label: "Observability", slug: "guides/observability" },
            { label: "Bundle Signing", slug: "guides/bundle-signing" },
          ],
        },
        {
          label: "API Reference",
          items: [
            { label: "CLI Commands", slug: "api/cli" },
            {
              label: "Admin API",
              slug: "api/admin-api",
            },
            { label: "Response Helpers", slug: "api/response-helpers" },
            { label: "Request Object", slug: "api/request" },
            { label: "Testing Library", slug: "api/testing-library" },
            { label: "Metrics Endpoint", slug: "api/metrics" },
            { label: "Function Manifest", slug: "api/function-manifest" },
          ],
        },
        {
          label: "Platform",
          items: [
            { label: "Web Standards Support", slug: "platform/web-standards" },
            {
              label: "Node.js Compatibility",
              slug: "platform/node-compatibility",
            },
            {
              label: "Virtual File System",
              slug: "platform/vfs",
            },
            {
              label: "Resource Limits",
              slug: "platform/resource-limits",
            },
          ],
        },
        {
          label: "Deployment",
          items: [
            { label: "Production Checklist", slug: "deployment/production-checklist" },
            { label: "Environment Variables", slug: "deployment/environment-variables" },
            { label: "TLS Configuration", slug: "deployment/tls" },
            { label: "Scaling", slug: "deployment/scaling" },
          ],
        },
        {
          label: "Development",
          items: [
            { label: "Contributing", slug: "development/contributing" },
            { label: "Project Structure", slug: "development/project-structure" },
            { label: "Running Tests", slug: "development/running-tests" },
          ],
        },
        {
          label: "Examples",
          items: [
            { label: "Overview", slug: "examples/overview" },
            { label: "Hello World", slug: "examples/hello-world" },
            { label: "JSON API", slug: "examples/json-api" },
            { label: "RESTful CRUD", slug: "examples/restful-crud" },
            { label: "More Examples", slug: "examples/more" },
          ],
        },
        {
          label: "Troubleshooting",
          slug: "troubleshooting",
        },
      ],
    }),
  ],
};

if (site) {
  config.site = site;
}

export default defineConfig(config);
