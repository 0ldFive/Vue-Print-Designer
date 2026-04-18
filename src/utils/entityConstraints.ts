import mergeWith from 'lodash/mergeWith';

export interface EntityPermissions {
  system: boolean;
  editable: boolean;
  deletable: boolean;
  copyable: boolean;
}

const cloneDeep = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cloneDeep) as any;
  const cloned: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = cloneDeep((obj as any)[key]);
    }
  }
  return cloned;
};

const isRecord = (value: unknown): value is Record<string, any> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

export const mergeExt = (...exts: (Record<string, any> | undefined | null)[]): Record<string, any> => {
  return mergeWith({}, ...exts.filter(isRecord), (objValue: any, srcValue: any) => {
    if (Array.isArray(srcValue)) {
      return srcValue;
    }
  });
};

const readBool = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

export const resolveEntityPermissions = (entity: unknown): EntityPermissions => {
  const source = isRecord(entity) ? entity : {};
  const nested = isRecord(source.permissions) ? source.permissions : {};

  const system = readBool(source.system)
    ?? readBool(source.isSystem)
    ?? readBool(nested.system)
    ?? readBool(nested.isSystem)
    ?? false;

  // System entries are readonly by default, but still copyable unless explicitly disabled.
  const editable = readBool(source.editable) ?? readBool(nested.editable) ?? !system;
  const deletable = readBool(source.deletable) ?? readBool(nested.deletable) ?? !system;
  const copyable = readBool(source.copyable) ?? readBool(nested.copyable) ?? true;

  return {
    system,
    editable: system ? false : editable,
    deletable: system ? false : deletable,
    copyable
  };
};

export const extractStandardTemplateFields = (entity: any) => {
  if (!isRecord(entity)) return {};
  const standard: any = {
    id: entity.id,
    name: entity.name,
    data: entity.data,
    updatedAt: entity.updatedAt,
  };
  if (entity.permissions !== undefined) standard.permissions = entity.permissions;
  if (entity.ext !== undefined) standard.ext = entity.ext;
  return standard;
};

export const extractStandardCustomElementFields = (entity: any) => {
  if (!isRecord(entity)) return {};
  const standard: any = {
    id: entity.id,
    name: entity.name,
    element: entity.element,
    testData: entity.testData,
  };
  if (entity.permissions !== undefined) standard.permissions = entity.permissions;
  if (entity.ext !== undefined) standard.ext = entity.ext;
  return standard;
};

export const normalizeEntityConstraints = <T extends Record<string, any>>(entity: T): T => {
  const permissions = resolveEntityPermissions(entity);
  const normalizedExt = isRecord(entity.ext) ? entity.ext : {};
  
  // Enforce standard fields only, stripping all non-standard root parameters
  const standard: any = {
    id: entity.id,
    name: entity.name,
    ext: normalizedExt,
    permissions: {
      ...(isRecord(entity.permissions) ? entity.permissions : {}),
      ...permissions
    }
  };

  // Conditionally add entity-specific standard fields
  if ('data' in entity) standard.data = entity.data;
  if ('updatedAt' in entity) standard.updatedAt = entity.updatedAt;
  if ('element' in entity) standard.element = entity.element;
  if ('testData' in entity) standard.testData = entity.testData;

  return standard as T;
};

export const canEditEntity = (entity: unknown) => resolveEntityPermissions(entity).editable;
export const canDeleteEntity = (entity: unknown) => resolveEntityPermissions(entity).deletable;
export const canCopyEntity = (entity: unknown) => resolveEntityPermissions(entity).copyable;

export const normalizeModalExtraValues = (values?: Record<string, any>) => {
  if (!values || !isRecord(values)) return undefined;
  
  const normalized: Record<string, any> = {};
  for (const key in values) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      normalized[key] = cloneDeep(values[key]);
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

export const applyModalExtraValues = <T extends Record<string, any>>(
  templateLike: T,
  mode: 'create' | 'edit' | 'copy',
  values?: Record<string, any>
): T => {
  const normalized = normalizeModalExtraValues(values);
  const ext = templateLike.ext && isRecord(templateLike.ext) ? templateLike.ext : {};
  const templateModalForm = ext.templateModalForm && isRecord(ext.templateModalForm)
    ? ext.templateModalForm
    : {};

  const lastMode = templateModalForm.lastMode;
  let modeData = normalized;

  if (!modeData) {
    if (templateModalForm[mode]) {
      modeData = templateModalForm[mode];
    } else if (lastMode && templateModalForm[lastMode]) {
      modeData = templateModalForm[lastMode];
    }
  }

  return {
    ...templateLike,
    ext: {
      ...ext,
      templateModalForm: {
        ...templateModalForm,
        ...(modeData ? { [mode]: modeData } : {}),
        lastMode: mode,
        updatedAt: Date.now()
      }
    }
  };
};
