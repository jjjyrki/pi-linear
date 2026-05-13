import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { LinearValidationError } from './errors.js';

export type ParsedTaskFile = {
  id: string;
  status: string;
  summary: string;
  filePath: string;
  subTasks: ParsedTaskSubTask[];
};

export type ParsedTaskSubTask = {
  key: string;
  title: string;
  description?: string;
  blockedBy: string[];
};

export async function parseTaskMarkdownFile(taskFilePath: string): Promise<ParsedTaskFile> {
  const filePath = validateTaskFilePath(taskFilePath);
  const content = await readFile(filePath, 'utf8');
  return parseTaskMarkdownContent(content, filePath);
}

export function parseTaskMarkdownContent(content: string, filePath = 'task.md'): ParsedTaskFile {
  const lines = content.split(/\r?\n/);
  const id = readHeaderValue(lines, 'id');
  const status = readHeaderValue(lines, 'status');
  const summary = readHeaderValue(lines, 'summary');

  return {
    id,
    status,
    summary,
    filePath,
    subTasks: parseImplementationSubTasks(lines, id),
  };
}

export function buildParentIssueTitle(task: ParsedTaskFile): string {
  return `${task.id}: ${task.summary}`;
}

export function buildSubTaskIssueTitle(subTask: ParsedTaskSubTask): string {
  return `${subTask.key}: ${subTask.title}`;
}

export function buildParentIssueDescription(task: ParsedTaskFile): string {
  return [
    `Task file: ${task.filePath}`,
    `Task ID: ${task.id}`,
    `Status: ${task.status}`,
    '',
    task.summary,
  ].join('\n');
}

export function buildSubTaskIssueDescription(task: ParsedTaskFile, subTask: ParsedTaskSubTask): string {
  const sections = [
    `Task file: ${task.filePath}`,
    `Task key: ${subTask.key}`,
  ];

  if (subTask.blockedBy.length > 0) {
    sections.push(`Blocked by: ${subTask.blockedBy.join(', ')}`);
  }

  if (subTask.description) {
    sections.push('', subTask.description);
  }

  return sections.join('\n');
}

export function normalizeTaskReference(value: string, parentTaskId: string): string {
  const trimmed = stripMarkdownCode(value.trim());
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return `${parentTaskId}.${trimmed}`;
  }
  return trimmed.replace(/^task-/i, 'TASK-');
}

function validateTaskFilePath(taskFilePath: string): string {
  if (typeof taskFilePath !== 'string' || taskFilePath.trim().length === 0) {
    throw new LinearValidationError('taskFilePath must be a non-empty string.');
  }

  const filePath = path.resolve(taskFilePath);
  if (path.extname(filePath).toLowerCase() !== '.md') {
    throw new LinearValidationError('taskFilePath must point to a markdown file.');
  }
  return filePath;
}

function readHeaderValue(lines: string[], fieldName: 'id' | 'status' | 'summary'): string {
  const line = lines.find((candidate) => candidate.startsWith(`${fieldName}:`));
  const value = line?.slice(fieldName.length + 1).trim();
  if (!value) {
    throw new LinearValidationError(`task file header must include ${fieldName}.`);
  }
  return fieldName === 'id' ? value.replace(/^task-/i, 'TASK-') : value;
}

function parseImplementationSubTasks(lines: string[], parentTaskId: string): ParsedTaskSubTask[] {
  const sectionStart = lines.findIndex((line) => /^#\s+Implementation sub-tasks\s*$/i.test(line.trim()));
  if (sectionStart === -1) {
    return [];
  }

  const sectionLines: string[] = [];
  for (let index = sectionStart + 1; index < lines.length; index += 1) {
    if (/^#\s+/.test(lines[index])) {
      break;
    }
    sectionLines.push(lines[index]);
  }

  const subTasks: ParsedTaskSubTask[] = [];
  let current: { key: string; title: string; detailLines: string[] } | undefined;

  for (const line of sectionLines) {
    const match = /^- \[[ xX]\]\s+([^:]+):\s+(.+)$/.exec(line);
    if (match) {
      if (current) {
        subTasks.push(finalizeSubTask(current, parentTaskId));
      }
      current = {
        key: normalizeTaskReference(match[1], parentTaskId),
        title: match[2].trim(),
        detailLines: [],
      };
      continue;
    }

    if (current && (line.trim().length > 0 || current.detailLines.length > 0)) {
      current.detailLines.push(line.replace(/^\s{2,}/, ''));
    }
  }

  if (current) {
    subTasks.push(finalizeSubTask(current, parentTaskId));
  }

  return subTasks;
}

function finalizeSubTask(
  subTask: { key: string; title: string; detailLines: string[] },
  parentTaskId: string,
): ParsedTaskSubTask {
  if (!subTask.title) {
    throw new LinearValidationError(`sub-task ${subTask.key} must include a title.`);
  }

  const blockedBy: string[] = [];
  const descriptionLines: string[] = [];

  for (const line of subTask.detailLines) {
    const dependencyMatch = /^-?\s*(?:Dependencies|Depends on|Blocked by):\s*(.+)$/i.exec(line.trim());
    if (dependencyMatch) {
      blockedBy.push(...parseDependencyList(dependencyMatch[1], parentTaskId));
      continue;
    }
    descriptionLines.push(line);
  }

  const description = trimBlankLines(descriptionLines).join('\n').trim();
  return {
    key: subTask.key,
    title: subTask.title,
    ...(description ? { description } : {}),
    blockedBy: [...new Set(blockedBy)],
  };
}

function parseDependencyList(value: string, parentTaskId: string): string[] {
  return value
    .split(',')
    .map((dependency) => normalizeTaskReference(dependency, parentTaskId))
    .filter((dependency) => dependency.length > 0);
}

function stripMarkdownCode(value: string): string {
  return value.replace(/^`|`$/g, '').trim();
}

function trimBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim().length === 0) start += 1;
  while (end > start && lines[end - 1].trim().length === 0) end -= 1;
  return lines.slice(start, end);
}
