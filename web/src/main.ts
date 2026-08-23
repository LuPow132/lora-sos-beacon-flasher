import "./styles.css";
import { t, lang, setLang, onLangChange } from "./i18n";
import { validateBeaconId, ID_MAX_LEN } from "./idblob";
import { loadFirmware, targetName, type LoadedFirmware } from "./manifest";
import { flash, FlashCancelled, type Phase } from "./flash";
import { SerialMonitor } from "./monitor";
import { isSupported } from "./serial";

const app = document.getElementById("app")!;

type Tab = "flash" | "monitor";
let tab: Tab = "flash";
let beaconId = "";
let busy = false;
let firmware: LoadedFirmware | null = null;
let firmwareError: string | null = null;

/** Binaries start downloading immediately so the Upload click never waits on the network. */
const firmwarePromise = loadFirmware()
  .then((fw) => (firmware = fw))
  .catch((e) => {
    firmwareError = e instanceof Error ? e.message : String(e);
    return null;
  });

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v as string;
    else (node as Record<string, unknown>)[k] = v;
  }
  for (const c of children) node.append(c);
  return node;
};

// ---------------------------------------------------------------- shell

function render() {
  document.documentElement.lang = lang();
  app.replaceChildren(header(), isSupported() ? body() : blocker(), footer());
}

function header(): HTMLElement {
  const s = t();
  const mk = (l: "th" | "en", label: string) => {
    const b = el("button", { textContent: label });
    b.setAttribute("aria-pressed", String(lang() === l));
    b.onclick = () => setLang(l);
    return b;
  };
  return el(
    "header",
    {},
    el(
      "div",
      { class: "grow" },
      el("h1", {}, s.title, el("span", { class: "dot", textContent: "." })),
      el("p", { class: "subtitle", textContent: s.subtitle }),
    ),
    el("div", { class: "langtoggle" }, mk("th", "ไทย"), mk("en", "EN")),
  );
}

function blocker(): HTMLElement {
  const s = t();
  return el(
    "div",
    { class: "blocker" },
    el("h2", { textContent: s.needChrome }),
    el("p", { textContent: s.needChromeMsg }),
  );
}

function body(): HTMLElement {
  const s = t();
  const wrap = el("div");

  const tabs = el("div", { class: "tabs" });
  ([
    ["flash", s.tabFlash],
    ["monitor", s.tabMonitor],
  ] as const).forEach(([id, label]) => {
    const b = el("button", { textContent: label });
    b.setAttribute("aria-selected", String(tab === id));
    b.onclick = () => {
      if (busy) return;
      tab = id;
      render();
    };
    tabs.append(b);
  });

  wrap.append(tabs, tab === "flash" ? flashTab() : monitorTab());
  return wrap;
}

function footer(): HTMLElement {
  const f = el("footer");
  const fw = firmware;
  if (fw) {
    const when = new Date(fw.manifest.buildTime).toISOString().slice(0, 10);
    f.append(`${t().firmwareInfo}: ${fw.manifest.label} · ${fw.manifest.coreVersion} · ${when}`);
  } else if (firmwareError) {
    f.append(`firmware: ${firmwareError}`);
  }
  return f;
}

// ---------------------------------------------------------------- flash tab

function flashTab(): HTMLElement {
  const s = t();
  const frag = el("div");

  // --- step 1: beacon id
  const input = el("input", {
    type: "text",
    placeholder: s.idPlaceholder,
    value: beaconId,
    maxLength: ID_MAX_LEN,
    autocomplete: "off",
    spellcheck: false,
  });
  input.setAttribute("inputmode", "latin");
  const fieldErr = el("p", { class: "fielderr" });

  const step1 = el(
    "section",
    { class: "step" },
    el("h2", {}, el("span", { class: "n", textContent: "1" }), s.step1),
    el("p", { class: "hint", textContent: s.step1Hint }),
    input,
    fieldErr,
  );

  // --- step 2: upload
  const uploadBtn = el("button", { class: "primary", textContent: s.flashBtn });
  const eraseBox = el("input", { type: "checkbox", id: "erase" });
  const progress = el("div", { class: "progress" });
  progress.hidden = true;
  const bar = el("div", { class: "fill" });
  const phaseLabel = el("span");
  const pctLabel = el("span");
  progress.append(
    el("div", { class: "label" }, phaseLabel, pctLabel),
    el("div", { class: "bar" }, bar),
  );

  const resultBox = el("div");
  const logPane = el("div", { class: "logpane" });
  const logDetails = el("details", {}, el("summary", { textContent: s.logTitle }), logPane);
  logDetails.hidden = true;

  const step2 = el(
    "section",
    { class: "step" },
    el("h2", {}, el("span", { class: "n", textContent: "2" }), s.step2),
    el("p", { class: "hint", textContent: s.step2Hint }),
    uploadBtn,
    progress,
    resultBox,
    el(
      "details",
      {},
      el("summary", { textContent: s.advanced }),
      el(
        "div",
        { class: "checkrow" },
        eraseBox,
        el(
          "label",
          { htmlFor: "erase" },
          s.eraseAll,
          el("span", { class: "sub", textContent: s.eraseAllHint }),
        ),
      ),
    ),
    logDetails,
  );

  // --- validation wiring
  const sync = () => {
    beaconId = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (input.value !== beaconId) input.value = beaconId;
    const err = validateBeaconId(beaconId);
    const showErr = err && beaconId.length > 0 ? err : null;
    fieldErr.textContent = showErr
      ? showErr === "chars"
        ? s.idErrChars
        : showErr === "long"
          ? s.idErrLong
          : s.idErrEmpty
      : "";
    input.classList.toggle("bad", Boolean(showErr));
    uploadBtn.disabled = busy || Boolean(err);
  };
  input.oninput = sync;
  sync();

  uploadBtn.onclick = async () => {
    if (validateBeaconId(beaconId)) return;

    busy = true;
    uploadBtn.disabled = true;
    uploadBtn.textContent = s.flashBtnBusy;
    resultBox.replaceChildren();
    logPane.textContent = "";
    logDetails.hidden = false;
    progress.hidden = false;
    bar.classList.remove("ok");
    bar.style.width = "0%";
    phaseLabel.textContent = s.pickPort;
    pctLabel.textContent = "";

    const log = (line: string) => {
      logPane.textContent += line.endsWith("\n") ? line : line + "\n";
      logPane.scrollTop = logPane.scrollHeight;
    };

    try {
      await firmwarePromise;
      if (!firmware) throw new Error(firmwareError ?? "firmware not loaded");

      await flash(firmware, beaconId, eraseBox.checked, {
        onPhase: (p: Phase) => {
          phaseLabel.textContent = {
            connecting: s.stConnecting,
            erasing: s.stErasing,
            writing: s.stWriting,
            resetting: s.stResetting,
            done: s.stDone,
          }[p];
        },
        onProgress: (frac) => {
          bar.style.width = `${(frac * 100).toFixed(1)}%`;
          pctLabel.textContent = `${Math.round(frac * 100)}%`;
        },
        onLog: log,
        onChipMismatch: (detected) => confirmMismatch(detected, resultBox),
      });

      bar.style.width = "100%";
      bar.classList.add("ok");
      pctLabel.textContent = "100%";
      resultBox.append(successBox(beaconId));
    } catch (e) {
      progress.hidden = true;
      if (e instanceof FlashCancelled) {
        resultBox.replaceChildren();
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        // The browser throws NotFoundError when the port chooser is dismissed;
        // that is a normal thing for a student to do, not a failure worth alarming them about.
        const friendly = /No port selected|NotFoundError/i.test(msg) ? s.errNoPort : msg;
        resultBox.append(errorBox(friendly));
        log(`ERROR: ${msg}`);
      }
    } finally {
      busy = false;
      uploadBtn.textContent = s.flashBtn;
      sync();
    }
  };

  frag.append(step1, step2, troubleshoot());
  return frag;
}

function successBox(id: string): HTMLElement {
  const s = t();
  const goMon = el("button", { class: "ghost", textContent: s.goMonitor });
  goMon.onclick = () => {
    tab = "monitor";
    render();
  };
  const again = el("button", { class: "ghost", textContent: s.flashAnother });
  again.onclick = () => render();

  return el(
    "div",
    { class: "result ok" },
    el("h3", { textContent: s.stDone }),
    el("div", { textContent: s.doneMsg(id) }),
    el("div", { class: "actions" }, goMon, again),
  );
}

function errorBox(msg: string): HTMLElement {
  const s = t();
  return el(
    "div",
    { class: "result err" },
    el("h3", { textContent: s.errFailed }),
    el("div", { textContent: s.errHint }),
    el("div", {}, el("code", { textContent: msg })),
  );
}

/** Shown when the attached chip is not the family the firmware was built for. */
function confirmMismatch(detected: string, mount: HTMLElement): Promise<boolean> {
  const s = t();
  return new Promise((resolve) => {
    const cont = el("button", { class: "ghost", textContent: s.tsContinue });
    const cancel = el("button", { class: "ghost", textContent: s.tsCancel });
    const box = el(
      "div",
      { class: "result err" },
      el("h3", { textContent: s.tsWrongChip(detected) }),
      el("div", { class: "actions" }, cont, cancel),
    );
    cont.onclick = () => {
      box.remove();
      resolve(true);
    };
    cancel.onclick = () => {
      box.remove();
      resolve(false);
    };
    mount.append(box);
  });
}

function troubleshoot(): HTMLElement {
  const s = t();
  const ol = el("ol");
  [s.ts1, s.ts2, s.ts3, s.ts4, s.ts5].forEach((x) => ol.append(el("li", { textContent: x })));
  return el("div", { class: "troubleshoot" }, el("h3", { textContent: s.tsTitle }), ol);
}

// ---------------------------------------------------------------- monitor tab

const MAX_LINES = 2000;
let monLines: string[] = [];
let monitor: SerialMonitor | null = null;
let autoscroll = true;

function monitorTab(): HTMLElement {
  const s = t();

  const consoleEl = el("div", { class: "console" });
  const statusEl = el("div", { class: "status" }, el("span", { class: "led" }), el("span"));
  const connectBtn = el("button", { class: "ghost" });
  const clearBtn = el("button", { class: "ghost", textContent: s.monClear });
  const saveBtn = el("button", { class: "ghost", textContent: s.monSave });
  const autoBox = el("input", { type: "checkbox", checked: autoscroll });

  const paint = () => {
    if (monLines.length === 0) {
      consoleEl.replaceChildren(el("div", { class: "empty", textContent: s.monEmpty }));
      return;
    }
    const frag = document.createDocumentFragment();
    for (const line of monLines) {
      frag.append(el("div", { class: classify(line), textContent: line }));
    }
    consoleEl.replaceChildren(frag);
    if (autoscroll) consoleEl.scrollTop = consoleEl.scrollHeight;
  };

  const setState = (running: boolean, error?: string) => {
    statusEl.classList.toggle("on", running);
    statusEl.lastElementChild!.textContent = running ? s.monConnected : (error ?? "");
    connectBtn.textContent = running ? s.monDisconnect : s.monConnect;
  };

  monitor ??= new SerialMonitor(
    (lines) => {
      monLines.push(...lines);
      if (monLines.length > MAX_LINES) monLines = monLines.slice(-MAX_LINES);
      paint();
    },
    setState,
  );

  connectBtn.onclick = async () => {
    connectBtn.disabled = true;
    try {
      if (monitor!.active) await monitor!.stop();
      else await monitor!.start();
    } finally {
      connectBtn.disabled = false;
    }
  };
  clearBtn.onclick = () => {
    monLines = [];
    paint();
  };
  saveBtn.onclick = () => {
    const blob = new Blob([monLines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `sos-beacon-${Date.now()}.txt` });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  autoBox.onchange = () => {
    autoscroll = autoBox.checked;
    if (autoscroll) consoleEl.scrollTop = consoleEl.scrollHeight;
  };

  setState(monitor.active);
  paint();

  return el(
    "section",
    { class: "step" },
    el("h2", {}, s.monTitle),
    el("p", { class: "hint", textContent: s.monHint }),
    el(
      "div",
      { class: "montoolbar" },
      connectBtn,
      clearBtn,
      saveBtn,
      el("label", {}, autoBox, s.monAutoscroll),
      el("span", { class: "spacer" }),
      statusEl,
    ),
    consoleEl,
  );
}

/** Colour-codes the sketch's own log prefixes so SOS transmissions stand out. */
function classify(line: string): string {
  if (line.includes("SOS|") || line.includes("กำลังส่ง")) return "sos";
  if (/ส่งสำเร็จ|FIX แล้ว|พร้อมใช้งาน/.test(line)) return "ok";
  if (/ไม่สำเร็จ|ERROR|error code/i.test(line)) return "err";
  if (/คำเตือน|ยังไม่ FIX|กำลังหา/.test(line)) return "warn";
  return "";
}

// ---------------------------------------------------------------- boot

onLangChange(render);
render();
firmwarePromise.then(render);

if (targetName() !== "tbeam") {
  console.info(`[flasher] using non-default firmware target: ${targetName()}`);
}
