import express from 'express';
import { body, param, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Task } from '../models/Task.js';
import { authenticate } from '../middleware/auth.js';
import { loadProject, requireProjectAdmin } from '../middleware/projectAccess.js';
import { checkValidation } from '../utils/validation.js';
import taskRoutes from './tasks.js';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.userId);
    const projects = await Project.find({
      $or: [{ owner: uid }, { 'members.user': uid }],
    })
      .populate('owner', 'name email')
      .sort({ updatedAt: -1 })
      .lean();

    const withRole = projects.map((p) => {
      const isOwner = p.owner._id.toString() === req.userId;
      const member = p.members.find((m) => m.user.toString() === req.userId);
      const role = isOwner ? 'admin' : member?.role ?? 'member';
      return { ...p, myRole: role };
    });

    res.json(withRole);
  } catch (err) {
    next(err);
  }
});

const createChecks = [
  body('name').trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 5000 }),
];

router.post('/', createChecks, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description = '' } = req.body;
    const project = await Project.create({
      name,
      description,
      owner: req.userId,
      members: [],
    });

    const populated = await Project.findById(project._id)
      .populate('owner', 'name email')
      .lean();

    res.status(201).json({ ...populated, myRole: 'admin' });
  } catch (err) {
    next(err);
  }
});

router.use(
  '/:projectId/tasks',
  param('projectId').isMongoId(),
  checkValidation,
  loadProject('projectId'),
  taskRoutes
);

router.get(
  '/:projectId',
  param('projectId').isMongoId(),
  checkValidation,
  loadProject('projectId'),
  async (req, res, next) => {
    try {
      const p = await Project.findById(req.project._id)
        .populate('owner', 'name email')
        .populate('members.user', 'name email')
        .lean();

      res.json({ ...p, myRole: req.projectRole });
    } catch (err) {
      next(err);
    }
  }
);

const updateChecks = [
  body('name').optional().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 5000 }),
];

router.patch(
  '/:projectId',
  param('projectId').isMongoId(),
  checkValidation,
  loadProject('projectId'),
  requireProjectAdmin,
  updateChecks,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (req.body.name !== undefined) req.project.name = req.body.name;
      if (req.body.description !== undefined) req.project.description = req.body.description;
      await req.project.save();

      const p = await Project.findById(req.project._id)
        .populate('owner', 'name email')
        .populate('members.user', 'name email')
        .lean();

      res.json({ ...p, myRole: req.projectRole });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:projectId',
  param('projectId').isMongoId(),
  checkValidation,
  loadProject('projectId'),
  requireProjectAdmin,
  async (req, res, next) => {
    try {
      await Task.deleteMany({ project: req.project._id });
      await Project.deleteOne({ _id: req.project._id });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

const memberChecks = [
  body('email').isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'member']),
];

router.post(
  '/:projectId/members',
  param('projectId').isMongoId(),
  checkValidation,
  loadProject('projectId'),
  requireProjectAdmin,
  memberChecks,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, role = 'member' } = req.body;
      const userToAdd = await User.findOne({ email });
      if (!userToAdd) {
        return res.status(404).json({ message: 'No user with that email.' });
      }

      if (userToAdd._id.toString() === req.project.owner.toString()) {
        return res.status(400).json({ message: 'Owner is already part of the project.' });
      }

      const exists = req.project.members.some((m) => m.user.toString() === userToAdd._id.toString());
      if (exists) {
        return res.status(409).json({ message: 'User is already a member.' });
      }

      req.project.members.push({ user: userToAdd._id, role });
      await req.project.save();

      const p = await Project.findById(req.project._id)
        .populate('owner', 'name email')
        .populate('members.user', 'name email')
        .lean();

      res.status(201).json(p);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:projectId/members/:userId',
  param('projectId').isMongoId(),
  param('userId').isMongoId(),
  checkValidation,
  loadProject('projectId'),
  requireProjectAdmin,
  body('role').isIn(['admin', 'member']),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      if (userId === req.project.owner.toString()) {
        return res.status(400).json({ message: 'Cannot change owner role via members.' });
      }

      const m = req.project.members.find((x) => x.user.toString() === userId);
      if (!m) {
        return res.status(404).json({ message: 'Member not found.' });
      }

      m.role = req.body.role;
      await req.project.save();

      const p = await Project.findById(req.project._id)
        .populate('owner', 'name email')
        .populate('members.user', 'name email')
        .lean();

      res.json(p);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:projectId/members/:userId',
  param('projectId').isMongoId(),
  param('userId').isMongoId(),
  checkValidation,
  loadProject('projectId'),
  requireProjectAdmin,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (userId === req.project.owner.toString()) {
        return res.status(400).json({ message: 'Cannot remove project owner.' });
      }

      req.project.members = req.project.members.filter((m) => m.user.toString() !== userId);
      await req.project.save();

      const p = await Project.findById(req.project._id)
        .populate('owner', 'name email')
        .populate('members.user', 'name email')
        .lean();

      res.json(p);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
