import mongoose from 'mongoose';
import { Project } from '../models/Project.js';

export function loadProject(paramName = 'projectId') {
  return async (req, res, next) => {
    try {
      const id = req.params[paramName];

      if (!req.userId) {
        return res.status(401).json({
          message: 'Unauthorized'
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          message: 'Invalid project ID.'
        });
      }

      const project = await Project.findById(id);

      if (!project) {
        return res.status(404).json({
          message: 'Project not found.'
        });
      }

      const uid = req.userId;
      const ownerId = project.owner?.toString();

      // Owner = Admin
      if (ownerId === uid) {
        req.project = project;
        req.projectRole = 'admin';
        return next();
      }

      // Member check
      const membership = project.members.find(
        (m) => m.user.toString() === uid
      );

      if (!membership) {
        return res.status(403).json({
          message: 'You are not a member of this project.'
        });
      }

      req.project = project;
      req.projectRole = membership.role;

      next();

    } catch (err) {
      next(err);
    }
  };
}

export function requireProjectAdmin(req, res, next) {
  if (req.projectRole !== 'admin') {
    return res.status(403).json({
      message: 'Admin access required for this action.'
    });
  }

  next();
}