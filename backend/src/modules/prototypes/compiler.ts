import path from "node:path";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  context,
  transform,
  version as esbuildVersion,
  type Loader,
} from "esbuild";
import {
  parse as parseHtml,
  parseFragment,
  serialize,
  type DefaultTreeAdapterTypes as Html,
} from "parse5";
import {
  parse,
  compileScript,
  compileTemplate,
  compileStyle,
  rewriteDefault,
} from "vue/compiler-sfc";
import { version as vueVersion } from "vue";
import { parse as parseJavaScript } from "@babel/parser";
import { HttpError } from "../../shared/http-error.js";
import { digest, previewPolicy, type SourceBundle } from "./manifest.js";
export const compilerIdentity = `esbuild ${esbuildVersion}; Vue ${vueVersion}; policy v1`;
const require = createRequire(import.meta.url);
const vueRuntime = () =>
  readFile(require.resolve("vue/dist/vue.runtime.esm-browser.prod.js"), "utf8");
export async function prototypeLicenses() {
  return [
    {
      path: ".ares/licenses/vue.txt",
      content: await readFile(
        path.join(path.dirname(require.resolve("vue/package.json")), "LICENSE"),
        "utf8",
      ),
    },
    {
      path: ".ares/licenses/ares.txt",
      content: await readFile(
        new URL("../../../../LICENSE", import.meta.url),
        "utf8",
      ),
    },
  ];
}
const fail = (message: string): never => {
  throw new HttpError(400, "PROTOTYPE_COMPILE", message);
};
const attr = (node: Html.Element, name: string) =>
  node.attrs.find((item) => item.name === name)?.value;
function resolveLocal(
  importer: string,
  input: string,
  files: Map<string, string>,
) {
  if (!input.startsWith(".") && !files.has(input))
    return fail(
      `Importación no permitida: ${input.slice(0, 160)}. Solo archivos incluidos y Vue preinstalado.`,
    );
  const normalized = path.posix.normalize(
    path.posix.join(path.posix.dirname(importer), input),
  );
  if (
    normalized.startsWith("../") ||
    normalized.startsWith("/") ||
    input.includes("\\")
  )
    return fail("La importación sale del conjunto de archivos.");
  const resolved = [
    normalized,
    ...[".ts", ".js", ".vue", ".json", ".css", "/index.ts", "/index.js"].map(
      (suffix) => normalized + suffix,
    ),
  ].find((candidate) => files.has(candidate));
  return resolved ?? fail(`Archivo no incluido: ${normalized.slice(0, 160)}`);
}
function compileVue(
  filename: string,
  source: string,
  files: Map<string, string>,
) {
  const parsed = parse(source, { filename });
  if (parsed.errors.length) fail(`SFC inválido: ${filename}`);
  const descriptor = parsed.descriptor,
    id = digest(filename).slice(0, 12);
  if (
    descriptor.customBlocks.length ||
    [
      descriptor.script,
      descriptor.scriptSetup,
      descriptor.template,
      ...descriptor.styles,
    ].some(
      (block) =>
        block &&
        (block.src ||
          (block.lang && !["ts", "js", "html", "css"].includes(block.lang))),
    )
  )
    fail(`No se admiten bloques externos ni preprocesadores en ${filename}.`);
  const script =
    descriptor.script || descriptor.scriptSetup
      ? compileScript(descriptor, {
          id,
          fs: {
            fileExists: (file) => files.has(file),
            readFile: (file) => files.get(file),
          },
        })
      : undefined;
  const template = descriptor.template
    ? compileTemplate({
        source: descriptor.template.content,
        filename,
        id,
        scoped: descriptor.styles.some((style) => style.scoped),
        compilerOptions: { bindingMetadata: script?.bindings },
      })
    : undefined;
  if (template?.errors.length) fail(`Plantilla Vue inválida: ${filename}`);
  const css = descriptor.styles
    .map((style) => {
      const result = compileStyle({
        source: style.content,
        filename,
        id: `data-v-${id}`,
        scoped: !!style.scoped,
      });
      if (result.errors.length) fail(`CSS inválido: ${filename}`);
      return result.code;
    })
    .join("\n");
  return `${script ? rewriteDefault(script.content, "__component", ["typescript"]) : "const __component={};"}\n${template?.code ?? ""}\n${template ? "__component.render=render;" : ""}\n${descriptor.styles.some((style) => style.scoped) ? `__component.__scopeId="data-v-${id}";` : ""}\n${css ? `{const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.append(style);}` : ""}\nexport default __component;`;
}
function validateImports(
  source: string,
  filename: string,
  files: Map<string, string>,
) {
  const ast = parseJavaScript(source, {
      sourceType: "module",
      plugins: ["typescript"],
    }),
    pending: unknown[] = [ast];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== "object") continue;
    const value = node as Record<string, unknown>;
    if (
      value.type === "ImportDeclaration" ||
      value.type === "ExportNamedDeclaration" ||
      value.type === "ExportAllDeclaration"
    ) {
      const from = value.source as { value?: string } | undefined;
      if (from?.value && from.value !== "vue")
        resolveLocal(filename, from.value, files);
    }
    if (value.type === "ImportExpression") {
      const from = value.source as
        { type?: string; value?: string } | undefined;
      if (from?.type !== "StringLiteral")
        fail("Los imports dinámicos deben tener una ruta literal incluida.");
      if (from?.value && from.value !== "vue")
        resolveLocal(filename, from.value, files);
    }
    for (const [key, item] of Object.entries(value))
      if (!["loc", "extra", "comments", "tokens"].includes(key)) {
        if (Array.isArray(item)) pending.push(...item);
        else if (item && typeof item === "object") pending.push(item);
      }
  }
}
async function bundle(
  entry: string,
  files: Map<string, string>,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const build = await context({
    entryPoints: [entry],
    bundle: true,
    write: false,
    outdir: "out",
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "inline",
    logLevel: "silent",
    plugins: [
      {
        name: "ares-closed-files",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.path === "vue")
              return { path: "vue", namespace: "trusted" };
            if (args.path.startsWith("data:") && args.kind === "url-token")
              return { path: args.path, external: true };
            const name =
              args.kind === "entry-point" && files.has(args.path)
                ? args.path
                : resolveLocal(args.importer, args.path, files);
            return { path: name, namespace: "virtual" };
          });
          build.onLoad({ filter: /.*/, namespace: "trusted" }, async () => ({
            contents: await vueRuntime(),
            loader: "js",
          }));
          build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => {
            const source = files.get(args.path);
            if (source === undefined) fail("Archivo no incluido.");
            const extension = path.posix.extname(args.path).slice(1),
              loader = (extension === "vue" ? "ts" : extension) as Loader;
            const contents =
              extension === "vue"
                ? compileVue(args.path, source!, files)
                : source!;
            if (["js", "ts", "vue"].includes(extension))
              validateImports(contents, args.path, files);
            return { contents, loader };
          });
        },
      },
    ],
  });
  const cancel = () => {
    void build.cancel();
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    const result = await build.rebuild();
    signal.throwIfAborted();
    return {
      js: result.outputFiles
        .filter((file) => file.path.endsWith(".js"))
        .map((file) => file.text)
        .join("\n"),
      css: result.outputFiles
        .filter((file) => file.path.endsWith(".css"))
        .map((file) => file.text)
        .join("\n"),
    };
  } finally {
    signal.removeEventListener("abort", cancel);
    await build.dispose();
  }
}
export async function compilePrototype(
  input: SourceBundle,
  revision: string,
  signal: AbortSignal,
) {
  const files = new Map(input.files.map((file) => [file.path, file.content])),
    document = parseHtml(files.get(input.entry)!);
  let inline = 0;
  const visit = async (node: Html.ParentNode) => {
    for (const child of [...node.childNodes]) {
      if (!("tagName" in child)) continue;
      const element = child as Html.Element,
        tag = element.tagName;
      if (
        tag === "base" ||
        (tag === "meta" &&
          ["refresh", "content-security-policy"].includes(
            attr(element, "http-equiv")?.toLowerCase() ?? "",
          ))
      ) {
        node.childNodes.splice(node.childNodes.indexOf(child), 1);
        continue;
      }
      if (tag === "link" && attr(element, "rel") === "stylesheet") {
        const href = attr(element, "href") ?? "",
          entry = resolveLocal(
            input.entry,
            href.startsWith(".") ? href : `./${href}`,
            files,
          ),
          result = await bundle(entry, files, signal);
        element.tagName = "style";
        element.nodeName = "style";
        element.attrs = [];
        element.childNodes = [
          { nodeName: "#text", value: result.css, parentNode: element },
        ];
      }
      if (tag === "script") {
        const type = attr(element, "type");
        if (
          type &&
          type !== "module" &&
          !["text/javascript", "application/javascript"].includes(type)
        )
          continue;
        const src = attr(element, "src"),
          entry = src
            ? resolveLocal(
                input.entry,
                src.startsWith(".") ? src : `./${src}`,
                files,
              )
            : path.posix.join(
                path.posix.dirname(input.entry),
                `__ares_inline_${inline++}.js`,
              );
        if (!src)
          files.set(
            entry,
            element.childNodes
              .map((item) => ("value" in item ? item.value : ""))
              .join(""),
          );
        let js: string,
          css = "";
        if (type === "module") {
          const result = await bundle(entry, files, signal);
          js = result.js;
          css = result.css;
        } else {
          const result = await transform(files.get(entry)!, {
            loader: entry.endsWith(".ts") ? "ts" : "js",
            target: "es2022",
            logLevel: "silent",
          });
          js = result.code;
        }
        element.attrs = element.attrs.filter(
          (item) =>
            !["src", "integrity", "crossorigin", "async", "defer"].includes(
              item.name,
            ),
        );
        element.childNodes = [
          { nodeName: "#text", value: js, parentNode: element },
        ];
        if (css) {
          const html = document.childNodes.find(
              (item) => "tagName" in item && item.tagName === "html",
            ) as Html.Element,
            head = html.childNodes.find(
              (item) => "tagName" in item && item.tagName === "head",
            ) as Html.Element;
          const style = parseFragment(
            `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`,
          ).childNodes[0]!;
          style.parentNode = head;
          head.childNodes.push(style);
        }
      }
      await visit(element);
    }
  };
  try {
    await visit(document);
  } catch (cause) {
    if (signal.aborted || cause instanceof HttpError) throw cause;
    throw new HttpError(
      400,
      "PROTOTYPE_COMPILE",
      "No se pudo compilar este conjunto. Revisa sintaxis, imports y dependencias; no se creó una demo sustituta.",
    );
  }
  const html = document.childNodes.find(
      (item) => "tagName" in item && item.tagName === "html",
    ) as Html.Element,
    head = html.childNodes.find(
      (item) => "tagName" in item && item.tagName === "head",
    ) as Html.Element;
  const bridge = `(()=>{const send=(level,text)=>{try{parent.postMessage({type:'ares-preview-log',artifact:${JSON.stringify(revision)},level,text:String(text).slice(0,2000)},'*')}catch{}};for(const level of ['log','warn','error']){const old=console[level].bind(console);console[level]=(...args)=>{old(...args);send(level,args.map(value=>{try{return typeof value==='string'?value:JSON.stringify(value)}catch{return '[valor no serializable]'}}).join(' '))}}addEventListener('error',event=>send('error',event.message));addEventListener('unhandledrejection',()=>send('error','Promesa rechazada en el prototipo'));})();`;
  const prefix = parseFragment(
    `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${previewPolicy}"><meta name="referrer" content="no-referrer"><script>${bridge}</script>`,
  ).childNodes;
  prefix.forEach((node) => {
    node.parentNode = head;
  });
  head.childNodes.unshift(...prefix);
  const content = serialize(document);
  if (Buffer.byteLength(content) > 2097152)
    fail("La salida compilada supera 2 MiB.");
  signal.throwIfAborted();
  return content;
}
