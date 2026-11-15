export class RealOperationUnavailableError extends Error {
  code: "REAL_OPERATION_UNAVAILABLE";
  operation: string;
  constructor(operation: string);
}

export function createRealReadOnlyProvider<T extends object>(
  value: T,
  readableMethods: readonly (keyof T)[],
  providerName: string,
): T;
