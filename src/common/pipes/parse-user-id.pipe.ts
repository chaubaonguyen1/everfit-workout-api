import { Injectable, PipeTransform } from '@nestjs/common';
import { ValidationError } from '../errors';

/** User ids come from the caller (no auth in scope), so bound them before they reach SQL or logs. */
export const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

@Injectable()
export class ParseUserIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (USER_ID_PATTERN.test(value)) return value;
    throw new ValidationError('Invalid userId', [
      { field: 'userId', issue: 'must be 1-64 characters: letters, digits, "_" or "-"' },
    ]);
  }
}
