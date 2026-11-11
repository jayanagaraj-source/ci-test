import { z } from 'zod';

export const TASK_STATUSES = ['todo', 'in_progress', 'done'];
export const TASK_PRIORITIES = ['low', 'medium', 'high'];

const status = z.enum(TASK_STATUSES);
const priority = z.enum(TASK_PRIORITIES);
const tags = z.array(z.string().trim().min(1).max(30)).max(10);

const fields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  status,
  priority,
  tags,
  dueDate: z.iso.datetime().nullable(),
};

export const createTaskSchema = z.strictObject({
  ...fields,
  description: fields.description.default(''),
  status: status.default('todo'),
  priority: priority.default('medium'),
  tags: tags.default([]),
  dueDate: fields.dueDate.default(null),
});

// Defined from the raw fields (no defaults) so a PATCH never resets
// properties the client did not send.
export const updateTaskSchema = z
  .strictObject(fields)
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'At least one field must be provided');

export const taskIdSchema = z.object({ id: z.uuid() });

export const listTasksQuerySchema = z.object({
  status: status.optional(),
  priority: priority.optional(),
  tag: z.string().trim().min(1).max(30).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
