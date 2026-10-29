<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, inject, nextTick } from "vue";
import { useI18n } from "@/locales";
import { useDesignerStore } from "@/stores/designer";
import startCase from "lodash/startCase";
import { formatShortcut } from "@/utils/os";
import X from "~icons/material-symbols/close";
import KeyboardIcon from "~icons/material-symbols/keyboard";
import InfoIcon from "~icons/material-symbols/info";
import GithubIcon from "@/svg/components/GithubIcon.vue";
import pkg from "../../../../package.json";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
}>();

const { t } = useI18n();
const designerStore = useDesignerStore();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));

const activeTab = ref<"shortcuts" | "about">("shortcuts");
const dependencyHeaderScrollRef = ref<HTMLElement | null>(null);
const dependencyBodyScrollRef = ref<HTMLElement | null>(null);
const dependencyHeaderTableRef = ref<HTMLTableElement | null>(null);
const dependencyBodyTableRef = ref<HTMLTableElement | null>(null);
const dependencyColumnWidths = ref<string[]>([]);

const close = () => {
  emit("update:show", false);
};

const handleKeydown = (e: KeyboardEvent) => {
  if (!props.show) return;
  if (e.key === "Escape") {
    e.preventDefault();
    close();
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

watch(
  () => props.show,
  (val) => {
    designerStore.setDisableGlobalShortcuts(val);
  },
);

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  if (props.show) {
    designerStore.setDisableGlobalShortcuts(false);
  }
});

const dependencies = [
  ...Object.entries(pkg.dependencies || {}).map(([name, version]) => ({
    name,
    version,
    type: "dep" as const,
  })),
  ...Object.entries(pkg.devDependencies || {}).map(([name, version]) => ({
    name,
    version,
    type: "dev" as const,
  })),
].map((d) => ({
  ...d,
  url: `https://www.npmjs.com/package/${encodeURIComponent(d.name)}`,
}));

type DependencyMeta = {
  description: string;
  homepage: string;
  author: string;
  license: string;
};

const dependencyMeta = ref<Record<string, DependencyMeta>>({});
let _descFetched = false;

const normalizeAuthor = (author: unknown) => {
  if (!author) return "-";
  if (typeof author === "string") {
    const text = author.trim();
    return text || "-";
  }
  if (typeof author === "object") {
    const name = (author as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) {
      return name.trim();
    }
  }
  return "-";
};

const normalizeLicense = (license: unknown) => {
  if (!license) return "-";
  if (typeof license === "string") {
    const text = license.trim();
    return text || "-";
  }
  if (typeof license === "object") {
    const type = (license as { type?: unknown }).type;
    if (typeof type === "string" && type.trim()) {
      return type.trim();
    }
  }
  return "-";
};

const getDependencyDescription = (name: string) => {
  const meta = dependencyMeta.value[name];
  if (!meta) return "-";
  return meta.description || meta.homepage || "-";
};

const getDependencyAuthor = (name: string) => {
  const meta = dependencyMeta.value[name];
  if (!meta) return "-";
  return meta.author || "-";
};

const getDependencyLicense = (name: string) => {
  const meta = dependencyMeta.value[name];
  if (!meta) return "-";
  return meta.license || "-";
};

const getDependencyColumnStyle = (columnIndex: number) => {
  const width = dependencyColumnWidths.value[columnIndex];
  if (!width) {
    return undefined;
  }
  return {
    width,
    minWidth: width,
  };
};

const syncDependencyHeaderScroll = () => {
  if (!dependencyHeaderScrollRef.value || !dependencyBodyScrollRef.value) {
    return;
  }
  dependencyHeaderScrollRef.value.scrollLeft =
    dependencyBodyScrollRef.value.scrollLeft;
};

const syncDependencyColumnWidths = () => {
  if (!dependencyHeaderTableRef.value || !dependencyBodyTableRef.value) {
    return;
  }

  const headerCells = dependencyHeaderTableRef.value.querySelectorAll<HTMLTableCellElement>(
    "thead th",
  );
  const firstBodyRow = dependencyBodyTableRef.value.querySelector("tbody tr");

  if (!firstBodyRow) {
    dependencyColumnWidths.value = [];
    return;
  }

  const bodyCells = firstBodyRow.querySelectorAll<HTMLTableCellElement>("td");
  if (!bodyCells.length) {
    dependencyColumnWidths.value = [];
    return;
  }

  dependencyColumnWidths.value = Array.from(bodyCells).map((cell, index) => {
    const bodyWidth = Math.ceil(cell.getBoundingClientRect().width);
    const headerWidth = Math.ceil(
      headerCells[index]?.getBoundingClientRect().width ?? 0,
    );
    return `${Math.max(bodyWidth, headerWidth)}px`;
  });
};

const refreshDependencyTableLayout = () => {
  dependencyColumnWidths.value = [];
  void nextTick(() => {
    syncDependencyColumnWidths();
    syncDependencyHeaderScroll();
  });
};

const fetchDescriptions = async () => {
  if (_descFetched) return;
  _descFetched = true;
  const results = await Promise.allSettled(
    dependencies.map(async (dep) => {
      const res = await fetch(
        `https://cdn.jsdelivr.net/npm/${dep.name}/package.json`,
      );
      const json = await res.json();
      return {
        name: dep.name,
        description: (json.description as string) || "",
        homepage: (json.homepage as string) || "",
        author: normalizeAuthor(json.author),
        license: normalizeLicense(json.license),
      };
    }),
  );
  const map: Record<string, DependencyMeta> = {};
  for (const dep of dependencies) {
    map[dep.name] = {
      description: "",
      homepage: "",
      author: "-",
      license: "-",
    };
  }
  for (const r of results) {
    if (r.status === "fulfilled") {
      map[r.value.name] = {
        description: r.value.description,
        homepage: r.value.homepage,
        author: r.value.author,
        license: r.value.license,
      };
    }
  }
  dependencyMeta.value = map;
  refreshDependencyTableLayout();
};

watch(
  [() => props.show, activeTab],
  ([visible, tab]) => {
    if (visible && tab === "about") {
      void fetchDescriptions();
      refreshDependencyTableLayout();
    }
  },
  { immediate: true },
);

const version = pkg.version;
const projectName = startCase(pkg.name);
</script>

<template>
  <Teleport :to="modalContainer || 'body'">
    <div
      v-if="show"
      class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 pointer-events-auto"
      @click.self="close"
    >
      <div
        class="bg-white rounded-lg shadow-xl w-[700px] max-w-full h-[500px] flex overflow-hidden"
      >
        <!-- Sidebar Tabs -->
        <div class="w-48 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
          <div class="flex items-center px-4 py-3 border-b border-gray-200 shrink-0">
            <h3 class="text-base font-semibold text-gray-800">
              {{ t("help.title") }}
            </h3>
          </div>
          <div class="flex-1 py-2">
            <button
              @click="activeTab = 'shortcuts'"
              class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors text-sm"
              :class="
                activeTab === 'shortcuts'
                  ? 'bg-white text-blue-600 border-l-4 border-blue-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'
              "
            >
              <KeyboardIcon class="w-5 h-5" />
              {{ t("shortcuts.title") }}
            </button>
            <button
              @click="activeTab = 'about'"
              class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors text-sm"
              :class="
                activeTab === 'about'
                  ? 'bg-white text-blue-600 border-l-4 border-blue-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'
              "
            >
              <InfoIcon class="w-5 h-5" />
              {{ t("help.about") }}
            </button>
          </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 flex flex-col min-w-0">
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0"
          >
            <h3 class="text-base font-semibold text-gray-800">
              {{
                activeTab === "shortcuts"
                  ? t("shortcuts.keyboardShortcuts")
                  : t("help.aboutProject", { name: projectName })
              }}
            </h3>
            <button
              @click="close"
              class="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6">
            <!-- Shortcuts Tab -->
            <div v-if="activeTab === 'shortcuts'" class="space-y-6">
              <div class="grid grid-cols-1 gap-6 text-sm">
                <!-- General Section -->
                <div>
                  <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">
                    {{ t("shortcuts.general") }}
                  </h4>
                  <ul class="space-y-2 text-gray-600">
                    <li class="flex justify-between items-center">
                      <span>{{ t("common.save") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "S"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.saveAsTemplate") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "Shift", "S"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("editor.print") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "P"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("editor.exportPdf") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "Shift", "E"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("editor.preview") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "Shift", "P"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("editor.viewJson") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "Shift", "J"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.newTemplate") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "Alt", "N"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.openSettings") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", ","]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("common.undo") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "Z"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("common.redo") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "Y"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.openHelp") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "H"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.zoom") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "Wheel"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.closeModal") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Esc"]) }}</kbd
                      >
                    </li>
                  </ul>
                </div>

                <!-- Editing Section -->
                <div>
                  <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">
                    {{ t("shortcuts.editing") }}
                  </h4>
                  <ul class="space-y-2 text-gray-600">
                    <li class="flex justify-between items-center">
                      <span>{{ t("common.copy") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "C"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("common.cut") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "X"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("common.paste") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "V"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("common.delete") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Delete"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.selectAll") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "A"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.multiSelect") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "Click"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.selectPenetrate") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{
                          formatShortcut([
                            t("shortcuts.alt"),
                            t("shortcuts.click"),
                          ])
                        }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.selectCycle") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ t("shortcuts.click") }} ×2</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span
                        >{{ t("common.lock") }}/{{ t("common.unlock") }}</span
                      >
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "L"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.customEditSave") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "S"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.customEditSaveAs") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "Shift", "S"]) }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.customEditExit") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ formatShortcut(["Ctrl", "Q"]) }}</kbd
                      >
                    </li>
                  </ul>
                </div>

                <!-- Manipulation Section -->
                <div>
                  <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">
                    {{ t("shortcuts.manipulation") }}
                  </h4>
                  <ul class="space-y-2 text-gray-600">
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.move") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{ t("shortcuts.arrow") }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.fastMove") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{
                          formatShortcut(["Shift", t("shortcuts.arrow")])
                        }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.snapRotate") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{
                          formatShortcut(["Shift", t("shortcuts.drag")])
                        }}</kbd
                      >
                    </li>
                    <li class="flex justify-between items-center">
                      <span>{{ t("shortcuts.resize") }}</span>
                      <kbd
                        class="bg-gray-100 px-2 py-0.5 rounded border text-xs"
                        >{{
                          formatShortcut(["Shift", t("shortcuts.resize")])
                        }}</kbd
                      >
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- About Tab -->
            <div v-if="activeTab === 'about'" class="space-y-6">
              <div class="text-center mb-8">
                <img
                  src="/src/assets/logo.png"
                  alt="Vue Print Designer"
                  class="w-12 h-12 mx-auto mb-2"
                />
                <h2 class="text-xl font-bold text-gray-800">
                  {{ projectName }}
                </h2>
                <div class="mt-1 text-xs text-gray-500">
                  {{ t("help.version") }} {{ version }}
                </div>
                <div class="mt-4 mx-auto max-w-md text-left">
                  <h4 class="font-medium text-gray-900 mb-2 border-b pb-1">
                    {{ t("help.links") }}
                  </h4>
                  <div class="space-y-2">
                    <div
                      class="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs"
                    >
                      <span
                        class="inline-flex items-center gap-1.5 text-gray-500"
                      >
                        <img
                          src="/src/assets/favicon.ico"
                          alt="Website"
                          class="w-3.5 h-3.5 rounded-sm"
                        />
                        {{ t("help.website") }}
                      </span>
                      <a
                        href="https://printdot.cc"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-gray-600 hover:text-blue-600 hover:underline"
                        title="https://printdot.cc"
                        >https://printdot.cc</a
                      >
                    </div>
                    <div
                      class="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs"
                    >
                      <span
                        class="inline-flex items-center gap-1.5 text-gray-500"
                      >
                        <GithubIcon class="w-3.5 h-3.5" />
                        {{ t("help.github") }}
                      </span>
                      <a
                        href="https://github.com/0ldFive/Vue-Print-Designer"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-gray-600 hover:text-blue-600 hover:underline"
                        title="https://github.com/0ldFive/Vue-Print-Designer"
                        >https://github.com/0ldFive/Vue-Print-Designer</a
                      >
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">
                  {{ t("help.dependencies") }}
                </h4>
                <div
                  class="bg-gray-50 rounded-lg overflow-hidden"
                >
                  <div
                    ref="dependencyHeaderScrollRef"
                    class="overflow-x-hidden overflow-y-hidden no-scrollbar"
                    @wheel.prevent.stop
                  >
                    <table
                      ref="dependencyHeaderTableRef"
                      class="min-w-full w-max text-xs text-left border-collapse"
                    >
                      <colgroup>
                        <col :style="getDependencyColumnStyle(0)" />
                        <col :style="getDependencyColumnStyle(1)" />
                        <col :style="getDependencyColumnStyle(2)" />
                        <col :style="getDependencyColumnStyle(3)" />
                        <col :style="getDependencyColumnStyle(4)" />
                        <col :style="getDependencyColumnStyle(5)" />
                      </colgroup>
                      <thead class="bg-gray-100 text-gray-700 font-medium">
                        <tr>
                          <th class="px-3 py-2 border border-gray-200 sticky left-0 z-30 bg-gray-100 whitespace-nowrap" style="box-shadow: inset -1px 0 0 #e5e7eb;">
                            {{ t("help.package") }}
                          </th>
                          <th class="px-3 py-2 border border-gray-200">
                            {{ t("help.type") }}
                          </th>
                          <th class="px-3 py-2 border border-gray-200">
                            {{ t("help.version") }}
                          </th>
                          <th class="px-3 py-2 border border-gray-200">
                            {{ t("help.license") }}
                          </th>
                          <th class="px-3 py-2 border border-gray-200">
                            {{ t("help.author") }}
                          </th>
                          <th class="px-3 py-2 border border-gray-200">
                            {{ t("help.description") }}
                          </th>
                        </tr>
                      </thead>
                    </table>
                  </div>

                  <div
                    ref="dependencyBodyScrollRef"
                    class="max-h-72 overflow-auto"
                    @scroll="syncDependencyHeaderScroll"
                  >
                    <table
                      ref="dependencyBodyTableRef"
                      class="min-w-full w-max text-xs text-left border-collapse"
                    >
                      <colgroup>
                        <col :style="getDependencyColumnStyle(0)" />
                        <col :style="getDependencyColumnStyle(1)" />
                        <col :style="getDependencyColumnStyle(2)" />
                        <col :style="getDependencyColumnStyle(3)" />
                        <col :style="getDependencyColumnStyle(4)" />
                        <col :style="getDependencyColumnStyle(5)" />
                      </colgroup>
                      <tbody class="divide-y divide-gray-200">
                      <tr
                        v-for="dep in dependencies"
                        :key="dep.name"
                        class="hover:bg-gray-50"
                      >
                        <td
                          class="px-3 py-1 border border-gray-200 text-gray-700 font-mono text-[11px] sticky left-0 z-[2] bg-gray-50 whitespace-nowrap"
                          style="box-shadow: inset -1px 0 0 #e5e7eb;"
                        >
                          <a
                            :href="dep.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            :title="dep.url"
                            class="hover:underline hover:decoration-blue-600 hover:text-blue-600 transition-colors"
                            >{{ dep.name }}</a
                          >
                        </td>
                        <td class="px-3 py-1 border border-gray-200">
                          <span
                            class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
                            :class="
                              dep.type === 'dep'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-500'
                            "
                          >
                            {{
                              t(
                                dep.type === "dep"
                                  ? "help.typeDep"
                                  : "help.typeDev",
                              )
                            }}
                          </span>
                        </td>
                        <td
                          class="px-3 py-1 border border-gray-200 text-gray-500 text-[11px] whitespace-nowrap"
                        >
                          {{ dep.version }}
                        </td>
                        <td class="px-3 py-1 border border-gray-200 text-gray-500 text-[11px] whitespace-nowrap">
                          {{ getDependencyLicense(dep.name) }}
                        </td>
                        <td class="px-3 py-1 border border-gray-200 text-gray-500 text-[11px] whitespace-nowrap">
                          {{ getDependencyAuthor(dep.name) }}
                        </td>
                        <td class="px-3 py-1 border border-gray-200 text-gray-400 text-[11px] whitespace-nowrap">
                          <span
                            :title="getDependencyDescription(dep.name)"
                            >{{ getDependencyDescription(dep.name) }}</span
                          >
                        </td>
                      </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
