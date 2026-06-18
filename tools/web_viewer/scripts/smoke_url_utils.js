export function trimSlashes(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '');
}

export function prefixRelativePath(relativePath, prefix) {
  const normalizedPath = trimSlashes(relativePath);
  const normalizedPrefix = trimSlashes(prefix);
  return normalizedPrefix ? `${normalizedPrefix}/${normalizedPath}` : normalizedPath;
}

export function prefixAbsolutePath(absolutePath, prefix) {
  const value = String(absolutePath || '').trim();
  const normalizedPrefix = trimSlashes(prefix);
  if (!value.startsWith('/') || !normalizedPrefix) {
    return value;
  }
  const prefixPath = `/${normalizedPrefix}`;
  if (value === prefixPath || value.startsWith(`${prefixPath}/`)) {
    return value;
  }
  return `${prefixPath}${value}`;
}
