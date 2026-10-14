import { ValidationPipe } from '@nestjs/common';
import { ValidationError } from '../errors';
import { flattenValidationErrors } from '../helpers/validation-error.helper';

/**
 * Global validation at the HTTP boundary: unknown fields are rejected (not silently dropped)
 * so typos like `weigth` surface as errors instead of becoming missing data.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new ValidationError('Request validation failed', flattenValidationErrors(errors)),
  });
}
