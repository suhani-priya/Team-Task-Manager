import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { Task } from '../models/Task.js';
import { requireProjectAdmin } from '../middleware/projectAccess.js';
import { checkValidation } from '../utils/validation.js';

const router = Router({ mergeParams: true });

router.get('/', async (req, res, next) => {
  try {
    const tasks = await Task.find({ project: req.project._id })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

const createChecks = [
  body('title').trim().isLength({ min: 1, max: 300 }),
  body('description').optional().isString().isLength({ max: 5000 }),
  body('status').optional().isIn(['todo', 'in_progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('assignedTo').optional({ nullable: true }).isMongoId(),
  body('dueDate').optional({ nullable: true }).isISO8601().toDate(),
];

router.post('/', requireProjectAdmin, createChecks, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description = '', status = 'todo', priority = 'medium', assignedTo = null, dueDate = null } = req.body;

    const task = await Task.create({
      project: req.project._id,
      title,
      description,
      status,
      priority,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
      createdBy: req.userId,
    });

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

const patchChecks = [
  param('taskId').isMongoId(),
  body('title').optional().trim().isLength({ min: 1, max: 300 }),
  body('description').optional().isString().isLength({ max: 5000 }),
  body('status').optional().isIn(['todo', 'in_progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('assignedTo').optional({ nullable: true }).isMongoId(),
  body('dueDate').optional({ nullable: true }).isISO8601().toDate(),
];

router.patch('/:taskId', patchChecks, checkValidation, async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      project: req.project._id,
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    if (req.projectRole === 'admin') {
      if (req.body.title !== undefined) task.title = req.body.title;
      if (req.body.description !== undefined) task.description = req.body.description;
      if (req.body.status !== undefined) task.status = req.body.status;
      if (req.body.priority !== undefined) task.priority = req.body.priority;
      if (req.body.assignedTo !== undefined) task.assignedTo = req.body.assignedTo || null;
      if (req.body.dueDate !== undefined) task.dueDate = req.body.dueDate;
    } else {
      if (req.body.title !== undefined || req.body.description !== undefined || req.body.assignedTo !== undefined || req.body.dueDate !== undefined) {
        return res.status(403).json({
          message: 'Members may only update the status of tasks assigned to them.',
        });
      }
      const assignedId = task.assignedTo?.toString() ?? null;
      if (!assignedId || assignedId !== req.userId) {
        return res.status(403).json({
          message: 'You can only update status for tasks assigned to you.',
        });
      }
      if (req.body.status === undefined) {
        return res.status(400).json({ message: 'Nothing to update.' });
      }
      task.status = req.body.status;
    }

    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .lean();

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/:taskId',
  param('taskId').isMongoId(),
  checkValidation,
  requireProjectAdmin,
  async (req, res, next) => {
    try {
      const result = await Task.deleteOne({
        _id: req.params.taskId,
        project: req.project._id,
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Task not found.' });
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
