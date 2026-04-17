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

export const normalizeEntityConstraints = <T extends Record<string, any>>(entity: T): T => {
  const permissions = resolveEntityPermissions(entity);
  const normalizedExt = isRecord(entity.ext) ? entity.ext : {};
  return {
    ...entity,
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
};

export const canEditEntity = (entity: unknown) => resolveEntityPermissions(entity).editable;
export const canDeleteEntity = (entity: unknown) => resolveEntityPermissions(entity).deletable;
export const canCopyEntity = (entity: unknown) => resolveEntityPermissions(entity).copyable;
