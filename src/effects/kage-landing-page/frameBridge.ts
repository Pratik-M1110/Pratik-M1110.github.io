/*
  Host-side glue for the sandboxed landing-page frame.

  Links. The frame is sandboxed without allow-popups-to-escape-sandbox, so a tab opened from inside
  it inherits that sandbox, and mailto:/tel: links can be refused inside a sandboxed frame. The frame
  is same-origin, so the host listens on its document and opens those links from the unsandboxed
  parent instead.

  Context loss. three.js handles webglcontextlost / webglcontextrestored itself, but it can throw
  while compiling a shader in the instant the context comes back, and the page re-queues its render
  loop only after a clean frame, so a single throw ends the scene for good. That is rare on a desktop
  and plausible on a phone that backgrounds the tab. The host watches for a scene that never resumes
  (or a context that never returns) and reloads the frame.
*/

const prepared = new WeakSet<Document>();

const RESTORE_TIMEOUT_MS = 8000; // a lost context that never comes back
const SETTLE_MS = 2500; // after a restore, how long the page gets to rebuild before it is checked
const PROBE_MS = 800; // how long frames are counted for
const MAX_AUTOMATIC_RELOADS = 2; // a failing GPU must not turn into a reload loop

let automaticReloads = 0;

type SceneWindow = Window & { __kage?: { renderer?: { info?: { render?: { frame?: number } } } } };

function routeLink(event: MouseEvent) {
  // Primary and middle buttons only; a right-click should still reach the context menu.
  if (event.defaultPrevented || event.button > 1) return;
  const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return;

  let url: URL;
  try {
    url = new URL(anchor.href);
  } catch {
    return;
  }

  if (url.protocol === "mailto:" || url.protocol === "tel:") {
    event.preventDefault();
    window.location.href = url.href;
    return;
  }

  if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== window.location.origin) {
    event.preventDefault();
    window.open(url.href, "_blank", "noopener,noreferrer");
  }
}

function watchContext(frame: HTMLIFrameElement, frameDocument: Document) {
  const frameWindow = frame.contentWindow as SceneWindow | null;
  const canvas = frameDocument.getElementById("gl");
  if (!frameWindow || !canvas) return;

  let timer = 0;
  const clear = () => window.clearTimeout(timer);
  const later = (delay: number, task: () => void) => {
    clear();
    timer = window.setTimeout(task, delay);
  };
  const rendered = () => frameWindow.__kage?.renderer?.info?.render?.frame;
  const reload = () => {
    if (!frame.isConnected || automaticReloads >= MAX_AUTOMATIC_RELOADS) return;
    automaticReloads += 1;
    frame.contentWindow?.location.reload();
  };

  canvas.addEventListener("webglcontextlost", () => later(RESTORE_TIMEOUT_MS, reload));
  canvas.addEventListener("webglcontextrestored", () =>
    later(SETTLE_MS, () => {
      // A hidden tab pauses the render loop on purpose; only a visible one can be judged. A page that does
      // not publish its renderer cannot be judged at all, so it is left alone.
      const before = rendered();
      if (document.hidden || before === undefined) return;
      later(PROBE_MS, () => {
        if (!document.hidden && rendered() === before) reload();
      });
    }),
  );
  frameWindow.addEventListener("pagehide", clear);
}

/** Safe to call repeatedly: each loaded document is prepared once. */
export function prepareFrame(frame: HTMLIFrameElement) {
  const frameDocument = frame.contentDocument;
  if (!frameDocument || prepared.has(frameDocument)) return;
  prepared.add(frameDocument);

  frameDocument.addEventListener("click", routeLink, true);
  frameDocument.addEventListener("auxclick", routeLink, true);
  watchContext(frame, frameDocument);
  // Lets the keyboard (arrows, space, page keys) scroll the page without a first click.
  frame.contentWindow?.focus();
}
