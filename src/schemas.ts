import { Type } from '@mariozechner/pi-ai';

import { friendlyPriorities } from './linear/shared.js';

export const nonEmptyTextSchema = Type.String();
export const optionalTextSchema = Type.Optional(Type.String());
export const dueDateSchema = Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' });
export const prioritySchema = Type.Union(friendlyPriorities.map((value) => Type.Literal(value)));

export const paginationSchema = Type.Object({
  first: Type.Optional(Type.Number()),
  after: Type.Optional(Type.String()),
});

export const sharedIssueIdentifierSchema = Type.String();
