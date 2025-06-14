import {
  isGitUrl,
  removeTempDir,
  createTempDir,
  cloneRepository,
  convertUrlToGitUrl,
  cleanupTempDirectories,
  extractRepositoryContent,
} from './utils';
import 'dotenv/config';
import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const timeoutId = setTimeout(() => {
    cleanupTempDirectories().catch(console.error);
    res.status(408).json({
      error: 'Request timeout',
      message: 'The request took too long to process. Please try again.',
    });
  }, 30000);

  res.on('finish', () => {
    clearTimeout(timeoutId);
  });

  next();
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  cleanupTempDirectories().catch(console.error);

  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong, please try again later',
  });
});

app.post('/ingest', async (req: Request, res: Response) => {
  const { url, ignorePatterns = [] } = req.body;
  let tempDir: string | null = null;

  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  try {
    if (!isGitUrl(url)) {
      res.status(400).json({ error: 'Invalid Git repository URL' });
      return;
    }

    const gitInfo = convertUrlToGitUrl(url);
    tempDir = createTempDir();

    await cloneRepository(gitInfo, tempDir);

    const { content, tree, index } = await extractRepositoryContent(tempDir, ignorePatterns);
    const output = `Repository Tree Structure:\n${tree}\n\nRepository Content:\n${content}`;

    res.json({
      message: 'Repository ingested successfully',
      data: {
        tree,
        content,
        index,
        normalized: output,
      },
    });

    if (tempDir) {
      console.log('Cleaning up temporary directory:', tempDir);
      await removeTempDir(tempDir);
    }
  } catch (error) {
    console.error('Error processing repository:', error);
    cleanupTempDirectories().catch(console.error);
    res.status(500).json({
      error: 'Failed to process repository',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(
    `Server is running on port ${process.env.PORT || 3000} in ${process.env.NODE_ENV} mode`,
  );
});
