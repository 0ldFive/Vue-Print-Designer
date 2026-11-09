
import { defineStore } from "pinia";
import { uuidv4 } from "@/utils/uuid";
import cloneDeep from "lodash/cloneDeep";
import {
  type DesignerState,
  type PrintElement,
  type TableColumn,
  type Page,
  type Guide,
  ElementType,
  type CustomElementTemplate,
  type WatermarkSettings,
  type CustomElementEditSnapshot,
  type BrandingSettings,
  type DesignerFontOption,
  type ListContextMenuConfig,
  type ListContextMenuItem,
  type TemplateModalFormConfig,
  type TemplateModalField,
} from "@/types";
import {
  getCrudConfig,
  buildEndpoint,
  buildFetchOptions,
} from "../../utils/crudConfig";
import { toast } from "../../utils/toast";
import {
  canCopyEntity,
  canDeleteEntity,
  canEditEntity,
  normalizeEntityConstraints,
  applyModalExtraValues,
  mergeExt,
} from "../../utils/entityConstraints";
import { useTemplateStore } from "../templates";
import { normalizeVariableKey } from "../../utils/variables";
import i18n from "../../locales";
import { defaultWatermark, defaultBranding, HISTORY_ACTION, hasOwn, inferElementUpdateHistoryAction, loadWatermark, loadDeveloperMode, loadPaginationDebugLogs, loadRenderDebugLogs, loadTextQuickToolbarEnabled, loadStatusBarVisible, getElementZIndex, getLayerSortedElements, buildLayerAssignments, canLayerMoveInPage, normalizeContextMenuConfig, normalizeTemplateModalFields, normalizeTemplateModalFormConfig, inferVariableFromContent, normalizeDesignerFontOptions, getEffectiveTableColumns, getNumericCellStyleHeight, getTableRowExplicitHeight, isHeaderFooterLineStyle, normalizeHeaderFooterLineStyle, normalizeHeaderFooterLineColor, normalizeHeaderFooterLineWidth, normalizeHeaderFooterLineSpanMode, normalizeHeaderFooterLineSpan, normalizeHeaderFooterLineRenderingEnabled, escapeAttributeSelectorValue, getCellBorderInsetRect, querySelectorAcrossDocumentAndShadowRoots } from './helpers';
import type { LayerMoveMode, HeaderFooterLineStyle, HeaderFooterLineSpanMode, EmbeddedCellBounds, EffectiveTableRows } from './helpers';
import { computeContinuousLayout } from "@/utils/continuousLayout";

export const getters = {
    // 连续纸布局：表格按内容撑高、下方元素下移、页面高度随内容增长。
    // 设计器渲染与导出/打印共用，保证所见即所得。
    continuousLayout: (state: DesignerState) => {
      const canvasHeight = state.canvasSize.height;
      if (!state.continuousPaper) {
        return {
          shiftById: new Map<string, number>(),
          heightById: new Map<string, number>(),
          contentHeight: canvasHeight,
        };
      }
      // 全页参与计算：元素 id 全局唯一，合并后按最大页高统一导出尺寸。
      return computeContinuousLayout(state.pages, canvasHeight, {
        canvasWidth: state.canvasSize.width,
        pageSpacingX: state.pageSpacingX,
      });
    },

    isTemplateEditable: (state: DesignerState) => {
      if (state.editingCustomElementId) return true;
      const templateStore = useTemplateStore();
      if (!templateStore.currentTemplateId) return true;
      const template = templateStore.templates.find(
        (t: any) => t.id === templateStore.currentTemplateId,
      );
      if (!template) return true;
      return canEditEntity(template);
    },
    selectedElement: (state: DesignerState) => {
      if (!state.selectedElementId) return null;
      for (const page of state.pages) {
        const el = page.elements.find((e: any) => e.id === state.selectedElementId);
        if (el) return el;
      }
      return null;
    },
    currentPage: (state: DesignerState) => state.pages[state.currentPageIndex],
    editingCustomElement: (state: DesignerState) => {
      if (!state.editingCustomElementId) return null;
      return (
        state.customElements.find(
          (el: any) => el.id === state.editingCustomElementId,
        ) || null
      );
    },
  };
