export class RealOperationUnavailableError extends Error {
  constructor(operation) {
    super(`Real-mode operation is unavailable: ${operation}. An authorized backend API is required.`);
    this.name = "RealOperationUnavailableError";
    this.code = "REAL_OPERATION_UNAVAILABLE";
    this.operation = operation;
  }
}

export function createRealReadOnlyProvider(value, readableMethods, providerName) {
  const readable = new Set(readableMethods);
  return new Proxy(value, {
    get(target, property, receiver) {
      const result = Reflect.get(target, property, receiver);
      if (typeof result !== "function") return result;
      if (readable.has(property)) return result.bind(target);

      return (..._args) => {
        const operation = `${providerName}.${String(property)}`;
        const error = new RealOperationUnavailableError(operation);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("enterflow:real-operation-unavailable", {
            detail: { operation, message: error.message },
          }));
        }
        throw error;
      };
    },
  });
}
