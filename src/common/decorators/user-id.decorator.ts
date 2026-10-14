import { Param } from '@nestjs/common';
import { ParseUserIdPipe } from '../pipes/parse-user-id.pipe';

/** `@UserIdParam() userId: string` — the validated `:userId` path parameter. */
export const UserIdParam = (): ParameterDecorator => Param('userId', ParseUserIdPipe);
