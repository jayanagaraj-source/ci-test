import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { createTaskController } from './task.controller.js';
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskIdSchema,
  updateTaskSchema,
} from './task.schemas.js';

export function createTaskRouter({ taskService, events }) {
  const router = Router();
  const controller = createTaskController({ taskService, events });

  // Must be registered before "/:id" so "events" is not treated as an id.
  router.get('/events', controller.stream);

  router.get('/', validate({ query: listTasksQuerySchema }), controller.list);
  router.post('/', validate({ body: createTaskSchema }), controller.create);
  router.get('/:id', validate({ params: taskIdSchema }), controller.get);
  router.patch('/:id', validate({ params: taskIdSchema, body: updateTaskSchema }), controller.update);
  router.delete('/:id', validate({ params: taskIdSchema }), controller.remove);

  return router;
}
