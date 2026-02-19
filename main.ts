import {
  assembleHTML,
  SERVICE_WORKER,
} from "./src/build-template.ts";

// ---------------------------------------------------------------------------
// Bundle JS with esbuild (subprocess for Deno compatibility)
// ---------------------------------------------------------------------------

function resolve(rel: string): string {
  return new URL(rel, import.meta.url).pathname;
}

async function bundleJS(): Promise<string> {
  const entryPoint = resolve("./src/app.js");
  const cmd = new Deno.Command("npx", {
    args: ["esbuild", "--bundle", "--format=iife", entryPoint],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await cmd.output();
  if (!output.success) {
    const err = new TextDecoder().decode(output.stderr);
    throw new Error(`esbuild failed:\n${err}`);
  }
  return new TextDecoder().decode(output.stdout);
}

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------

async function buildHTML(): Promise<string> {
  const css = await Deno.readTextFile(resolve("./src/styles.css"));
  const js = await bundleJS();
  return assembleHTML(css, js);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { buildHTML, SERVICE_WORKER as sw };

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  if (Deno.args.includes("--build")) {
    const html = await buildHTML();
    await Deno.mkdir("docs", { recursive: true });
    await Deno.writeTextFile("docs/index.html", html);
    await Deno.writeTextFile("docs/sw.js", SERVICE_WORKER);
    console.log("Built to docs/index.html + docs/sw.js");
  } else {
    const html = await buildHTML();
    Deno.serve({ port: 8001 }, (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/sw.js") {
        return new Response(SERVICE_WORKER, {
          headers: { "content-type": "application/javascript" },
        });
      }
      return new Response(html, {
        headers: { "content-type": "text/html" },
      });
    });
  }
}
