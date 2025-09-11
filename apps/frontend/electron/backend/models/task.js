const { z } = require('zod');

const TaskStatus = z.enum(['todo', 'in progress', 'done', 'archived']);
const TaskCreate = z.object({
title: z.string().min(1),
description: z.string().optional().default(''),
due_at: z.string().datetime().nullish(),
tags: z.array(z.string()).optional().default([]),
});
const TaskUpdate = z.object({
id: z.number().int().positive(),
title: z.string().min(1).optional(),
description: z.string().optional(),
status: TaskStatus.optional(),
due_at: z.string().datetime().nullish().optional(),
tags: z.array(z.string()).optional(),
});

module.exports = { TaskStatus, TaskCreate, TaskUpdate };