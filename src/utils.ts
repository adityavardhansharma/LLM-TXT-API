import os from 'os';
import path from 'path';
import { glob } from 'glob';
import ignore from 'ignore';
import crypto from 'crypto';
import { rimraf } from 'rimraf';
import { Extract } from 'unzipper';
import { execSync } from 'child_process';
import fs, { createWriteStream } from 'fs';

const DEFAULT_IGNORE_PATTERNS = [
  '**/*.lock',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/Gemfile.lock',
  '**/Cargo.lock',
  '**/composer.lock',
  '**/poetry.lock',
  '**/go.sum',
  '**/yarn.lock',
  '**/bun.lockb',
  '**/pnpm-lock.yaml',
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',
];

/**
 * Converts a GitHub or GitLab web URL to a git URL
 * @param url - The URL to convert
 * @returns Object containing the git URL and optionally the branch
 */
export const convertUrlToGitUrl = (
  url: string,
): {
  url: string;
  branch?: string;
} => {
  const githubWebPattern = /^https:\/\/github\.com\/([^/]+)\/([^/]+)(\/tree\/([^/]+))?/;
  const githubRepoPattern = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/;

  const gitlabWebPattern = /^https:\/\/gitlab\.com\/([^/]+)\/([^/]+)(\/-\/tree\/([^/]+))?/;
  const gitlabRepoPattern = /^https:\/\/gitlab\.com\/([^/]+)\/([^/]+)$/;

  let match;

  if ((match = url.match(githubWebPattern)) || (match = url.match(githubRepoPattern))) {
    const [, owner, repo, , branch] = match;
    const cleanRepo = repo.replace(/\.git$/, '');
    return {
      url: `https://github.com/${owner}/${cleanRepo}.git`,
      ...(branch && { branch }),
    };
  }

  if ((match = url.match(gitlabWebPattern)) || (match = url.match(gitlabRepoPattern))) {
    const [, owner, repo, , branch] = match;
    const cleanRepo = repo.replace(/\.git$/, '');
    return {
      url: `https://gitlab.com/${owner}/${cleanRepo}.git`,
      ...(branch && { branch }),
    };
  }

  return { url };
};

/**
 * Checks if a string is a valid Git URL or web URL
 * @param url - The URL to check
 * @returns boolean indicating if it's a valid git repository URL
 */
export const isGitUrl = (url: string): boolean => {
  const patterns = [
    /^git@[^:]+:.+\.git$/,
    /^https:\/\/[^/]+\/.+\.git$/,
    /^https:\/\/github\.com\/[^/]+\/[^/]+(\/tree\/[^/]+)?$/,
    /^https:\/\/gitlab\.com\/[^/]+\/[^/]+(\/-\/tree\/[^/]+)?$/,
  ];

  return patterns.some((pattern) => pattern.test(url));
};

/**
 * Checks if a file is likely to be binary by examining its contents.
 * Uses a heuristic approach by checking for null bytes in the first portion of the file.
 *
 * @param filePath - The path to the file to check
 * @returns True if the file is likely binary, false otherwise
 */
export const isBinaryFile = (filePath: string): boolean => {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
    fs.closeSync(fd);

    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * Recursively lists files and directories in a tree-like structure
 *
 * @param dir - Directory to traverse
 * @param prefix - Prefix for the current line (used for recursion)
 * @param ignoreFilter - Ignore filter for files/directories
 * @returns Array of strings representing the tree structure
 */
export const listDirectoryTree = (
  dir: string,
  prefix: string = '',
  ignoreFilter: ReturnType<typeof ignore>,
): string[] => {
  const entries: string[] = [];
  const items = fs.readdirSync(dir);

  const visibleItems = items.filter((item) => {
    const itemPath = path.join(dir, item);
    const relativePath = path.relative(process.cwd(), itemPath);
    return !ignoreFilter.ignores(relativePath);
  });

  visibleItems.sort((a, b) => {
    const aStats = fs.statSync(path.join(dir, a));
    const bStats = fs.statSync(path.join(dir, b));
    if (aStats.isDirectory() && !bStats.isDirectory()) return -1;
    if (!aStats.isDirectory() && bStats.isDirectory()) return 1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });

  visibleItems.forEach((item, index) => {
    const itemPath = path.join(dir, item);
    const isLast = index === visibleItems.length - 1;
    const stats = fs.statSync(itemPath);

    const marker = isLast ? '└── ' : '├── ';
    const newPrefix = prefix + (isLast ? '    ' : '│   ');

    entries.push(prefix + marker + item);

    if (stats.isDirectory()) {
      entries.push(...listDirectoryTree(itemPath, newPrefix, ignoreFilter));
    }
  });

  return entries;
};

/**
 * Generates a tree structure of the repository, respecting .gitignore rules and additional ignore patterns
 *
 * @param repoPath - Path to the local git repository
 * @param additionalIgnorePatterns - Additional glob patterns to ignore
 * @returns The tree structure as a string
 */
export const generateTreeStructure = (
  repoPath: string,
  additionalIgnorePatterns: string[] = [],
): string => {
  try {
    const gitignorePath = path.join(repoPath, '.gitignore');
    const ignoreFilter = ignore();

    ignoreFilter.add(['.git']);

    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      ignoreFilter.add(gitignoreContent);
    }

    if (additionalIgnorePatterns.length > 0) {
      ignoreFilter.add(additionalIgnorePatterns);
    }

    const originalCwd = process.cwd();
    process.chdir(repoPath);

    try {
      const tree = listDirectoryTree(repoPath, '', ignoreFilter);
      return tree.join('\n') + '\n';
    } finally {
      process.chdir(originalCwd);
    }
  } catch (error) {
    console.error(
      'Error generating tree structure:',
      error instanceof Error ? error.message : String(error),
    );
    return '';
  }
};

/**
 * Extracts text content from a local git repository, respecting .gitignore rules.
 * Skips binary files and handles errors gracefully.
 *
 * @param repoPath - Path to the local git repository
 * @param additionalIgnorePatterns - Additional glob patterns to ignore
 * @returns Object containing repository content and tree structure
 */
export const extractRepositoryContent = async (
  repoPath: string,
  additionalIgnorePatterns: string[] = [],
): Promise<{ content: string; tree: string }> => {
  if (!fs.existsSync(repoPath)) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }

  const ignoreFilter = ignore();
  const gitignorePath = path.join(repoPath, '.gitignore');
  ignoreFilter.add(['.git/**', ...DEFAULT_IGNORE_PATTERNS]);

  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    ignoreFilter.add(gitignoreContent);
  }

  if (additionalIgnorePatterns.length > 0) {
    ignoreFilter.add(additionalIgnorePatterns);
  }

  const files = await glob('**/*', {
    cwd: repoPath,
    dot: true,
    nodir: true,
    absolute: true,
  });

  const contentParts: string[] = [];
  for (const file of files) {
    const relativePath = path.relative(repoPath, file);

    if (ignoreFilter.ignores(relativePath)) {
      continue;
    }

    try {
      if (isBinaryFile(file)) {
        continue;
      }

      const content = fs.readFileSync(file, 'utf-8');
      contentParts.push(`File: ${relativePath}\n${content}\n`);
    } catch (error) {
      console.error(
        `Error processing file ${file}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const tree = generateTreeStructure(repoPath, additionalIgnorePatterns);

  return {
    content: contentParts.join('\n'),
    tree,
  };
};

/**
 * Gets the available disk space in bytes for the given path
 * @param path - The path to check disk space for
 * @returns Available space in bytes
 */
const getAvailableDiskSpace = (path: string): number => {
  try {
    const output = execSync(`df -B1 ${path}`).toString();
    const lines = output.split('\n');
    if (lines.length < 2) return 0;

    const [, , , available] = lines[1].split(/\s+/);
    return parseInt(available, 10);
  } catch (error) {
    console.error('Error checking disk space:', error);
    return 0;
  }
};

/**
 * Checks if there's enough disk space available
 * @param requiredSpace - Required space in bytes
 * @returns boolean indicating if there's enough space
 */
const hasEnoughDiskSpace = (requiredSpace: number): boolean => {
  const availableSpace = getAvailableDiskSpace(os.tmpdir());
  return availableSpace >= requiredSpace * 2;
};

/**
 * Cleans up old temporary directories that are older than the specified age
 * @param maxAgeHours - Maximum age of temp directories in hours
 */
const cleanupOldTempDirs = (maxAgeHours: number = 24): void => {
  const tmpDir = os.tmpdir();
  const items = fs.readdirSync(tmpDir);
  const now = Date.now();

  for (const item of items) {
    if (item.startsWith('repogist-') || item.startsWith('repo-')) {
      const itemPath = path.join(tmpDir, item);
      try {
        const stats = fs.statSync(itemPath);
        const ageHours = (now - stats.mtimeMs) / (1000 * 60 * 60);

        if (ageHours > maxAgeHours) {
          fs.rmSync(itemPath, { recursive: true, force: true });
        }
      } catch (error) {
        console.error(`Failed to process temp directory ${itemPath}:`, error);
      }
    }
  }
};

/**
 * Creates a temporary directory for cloning the repository
 * @returns Path to the temporary directory
 */
export const createTempDir = (): string => {
  cleanupOldTempDirs();

  const MIN_REQUIRED_SPACE = 1024 * 1024 * 1024;
  if (!hasEnoughDiskSpace(MIN_REQUIRED_SPACE)) {
    throw new Error('Not enough disk space available. Please free up some space and try again.');
  }

  const tmpDir = path.join(os.tmpdir(), `repogist-${crypto.randomBytes(6).toString('hex')}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
};

/**
 * Downloads a file from a URL to a specified path
 * @param url - The URL to download from
 * @param targetPath - The path to save the file to
 */
const downloadFile = async (url: string, targetPath: string): Promise<void> => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'repogist-api',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  const MAX_DOWNLOAD_SIZE = 1024 * 1024 * 1024;

  if (contentLength > MAX_DOWNLOAD_SIZE) {
    throw new Error(`Repository size exceeds maximum allowed size of 1GB`);
  }

  if (!hasEnoughDiskSpace(contentLength)) {
    throw new Error('Not enough disk space available for download');
  }

  const fileStream = createWriteStream(targetPath);
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('Failed to get response reader');
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(value);
    }
    fileStream.end();
  } finally {
    reader.releaseLock();
  }
};

/**
 * Gets the default branch for a GitHub or GitLab repository
 * @param url - The repository URL
 * @returns Promise resolving to the default branch name
 */
const getDefaultBranch = async (url: string): Promise<string> => {
  const githubMatch = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)(\.git)?$/);
  const gitlabMatch = url.match(/^https:\/\/gitlab\.com\/([^/]+)\/([^/]+)(\.git)?$/);

  if (githubMatch) {
    const [, owner, repo] = githubMatch;
    const cleanRepo = repo.replace(/\.git$/, '');
    const response = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}`, {
      headers: {
        'User-Agent': 'repogist-api',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get GitHub repository info: ${response.status} ${response.statusText}`,
      );
    }

    const repoInfo = await response.json();
    return repoInfo.default_branch;
  }

  if (gitlabMatch) {
    const [, owner, repo] = gitlabMatch;
    const cleanRepo = repo.replace(/\.git$/, '');
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${owner}/${cleanRepo}`)}`,
      {
        headers: {
          'User-Agent': 'repogist-api',
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get GitLab repository info: ${response.status} ${response.statusText}`,
      );
    }

    const repoInfo = await response.json();
    return repoInfo.default_branch;
  }

  throw new Error('Unsupported repository URL format');
};

/**
 * Gets the ZIP download URL for a GitHub or GitLab repository
 * @param url - The repository URL
 * @param branch - Optional branch name
 * @returns Promise resolving to the ZIP download URL
 */
const getZipDownloadUrl = async (url: string, branch?: string): Promise<string> => {
  const githubMatch = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)(\.git)?$/);
  const gitlabMatch = url.match(/^https:\/\/gitlab\.com\/([^/]+)\/([^/]+)(\.git)?$/);

  if (!branch) {
    branch = await getDefaultBranch(url);
  }

  if (githubMatch) {
    const [, owner, repo] = githubMatch;
    const cleanRepo = repo.replace(/\.git$/, '');
    return `https://github.com/${owner}/${cleanRepo}/archive/${branch}.zip`;
  }

  if (gitlabMatch) {
    const [, owner, repo] = gitlabMatch;
    const cleanRepo = repo.replace(/\.git$/, '');
    return `https://gitlab.com/${owner}/${cleanRepo}/-/archive/${branch}/${cleanRepo}-${branch}.zip`;
  }

  throw new Error('Unsupported repository URL format');
};

/**
 * Downloads and extracts a repository from a ZIP archive
 * @param gitInfo - Object containing git URL and optional branch
 * @param targetDir - Directory to extract into
 */
export const cloneRepository = async (
  {
    url,
    branch,
  }: {
    url: string;
    branch?: string;
  },
  targetDir: string,
): Promise<void> => {
  try {
    const zipUrl = await getZipDownloadUrl(url, branch);
    const zipPath = path.join(os.tmpdir(), `repo-${crypto.randomBytes(6).toString('hex')}.zip`);

    await downloadFile(zipUrl, zipPath);

    const extractDir = path.join(targetDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });

    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(Extract({ path: extractDir }))
        .on('close', () => {
          const extractedDir = fs.readdirSync(extractDir)[0];
          const extractedPath = path.join(extractDir, extractedDir);

          fs.readdirSync(extractedPath).forEach((file) => {
            fs.renameSync(path.join(extractedPath, file), path.join(targetDir, file));
          });

          fs.rmSync(extractDir, { recursive: true });
          fs.unlinkSync(zipPath);
          resolve(undefined);
        })
        .on('error', reject);
    });
  } catch (error) {
    throw new Error(
      `Failed to download and extract repository: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Removes a directory and its contents recursively
 * @param dir - Directory to remove
 */
export const removeTempDir = async (dir: string): Promise<void> => {
  try {
    await rimraf(dir);
  } catch (error) {
    console.error(
      `Warning: Failed to remove temporary directory ${dir}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Cleans up all temp directories created by this application
 */
export const cleanupTempDirectories = async () => {
  const tmpDir = os.tmpdir();
  const items = fs.readdirSync(tmpDir);

  for (const item of items) {
    if (item.startsWith('repogist-') || item.startsWith('repo-')) {
      const itemPath = path.join(tmpDir, item);
      try {
        await removeTempDir(itemPath);
      } catch (error) {
        console.error(`Failed to remove temp directory ${itemPath}:`, error);
      }
    }
  }
};
