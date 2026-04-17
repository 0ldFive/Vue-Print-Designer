export interface EntityPermissions {
  system: boolean;
  editable: boolean;
  deletable: boolean;
  copyable: boolean;
}

const isRecord = (value: unknown): value is Record<string, any> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
  if (entity.system !== undefined) standard.system = entity.system;
  if (entity.editable !== undefined) standard.editable = entity.editable;
  if (entity.deletable !== undefined) standard.deletable = entity.deletable;
  if (entity.copyable !== undefined) standard.copyable = entity.copyable;
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
  if (entity.system !== undefined) standard.system = entity.system;
  if (entity.editable !== undefined) standard.editable = entity.editable;
  if (entity.deletable !== undefined) standard.deletable = entity.deletable;
  if (entity.copyable !== undefined) standard.copyable = entity.copyable;
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
    system: permissions.system,
    editable: permissions.editable,
    deletable: permissions.deletable,
    copyable: permissions.copyable,
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
