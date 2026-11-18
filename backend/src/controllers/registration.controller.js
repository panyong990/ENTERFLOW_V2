export function createRegistrationController({ register }) {
  if (typeof register !== 'function') {
    throw new Error('A valid registration service is required.');
  }

  async function registerClient(request, response) {
    try {
      const result = await register(request.body, { requestId: request.requestId });
      // Explicit response shapes keep internal service data out of the API.
      if (result?.success === true) {
        return response.status(201).json({
          success: true,
          data: { status: 'pending' },
          message: 'Application submitted for review.'
        });
      }
      if (result?.success === false && result.code === 'VALIDATION_ERROR') {
        return response.status(400).json({
          success: false,
          message: 'Invalid registration details.',
          errors: result.errors
        });
      }
      if (result?.success === false && result.code === 'IDENTITY_CONFLICT') {
        return response.status(409).json({
          success: false,
          message: 'An account or application already uses these registration details.'
        });
      }
    } catch {
      // Never forward exceptions, SQL, credentials, or stack traces.
    }
    return response.status(503).json({
      success: false,
      message: 'Registration service is temporarily unavailable.'
    });
  }

  return { registerClient };
}
