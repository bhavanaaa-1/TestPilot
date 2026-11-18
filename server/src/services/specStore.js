/**
 * In-Memory Specification Store
 * Holds the currently uploaded and parsed OpenAPI specification.
 * Modular design allows swapping with database persistence in future phases.
 */

let currentSpec = null;

function setCurrentSpec(specData) {
  currentSpec = {
    ...specData,
    loadedAt: new Date().toISOString(),
  };
  return currentSpec;
}

function getCurrentSpec() {
  return currentSpec;
}

function getEndpointById(id) {
  if (!currentSpec || !Array.isArray(currentSpec.endpoints)) {
    return null;
  }
  return currentSpec.endpoints.find((ep) => ep.id === id) || null;
}

function getEndpointByMethodAndPath(method, path) {
  if (!currentSpec || !Array.isArray(currentSpec.endpoints)) {
    return null;
  }
  const targetMethod = String(method || '').toUpperCase();
  const targetPath = String(path || '').toLowerCase();
  return (
    currentSpec.endpoints.find(
      (ep) =>
        ep.method.toUpperCase() === targetMethod &&
        (ep.path.toLowerCase() === targetPath ||
          ep.path.replace(/\{[^}]+\}/g, '').toLowerCase() === targetPath.replace(/\{[^}]+\}/g, '').toLowerCase())
    ) || null
  );
}

function clearCurrentSpec() {
  const previous = currentSpec;
  currentSpec = null;
  return previous;
}

module.exports = {
  setCurrentSpec,
  getCurrentSpec,
  getEndpointById,
  getEndpointByMethodAndPath,
  clearCurrentSpec,
};
