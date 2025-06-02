import {
  convertUrlToGitUrl,
  createTempDir,
  isGitUrl,
  cloneRepository,
  extractRepositoryContent,
  removeTempDir,
} from './utils';
import 'dotenv/config';
import cors from 'cors';
import express, { Request, Response } from 'express';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

    const { content, tree } = await extractRepositoryContent(tempDir, ignorePatterns);
    const output = `Repository Tree Structure:\n${tree}\n\nRepository Content:\n${content}`;

    res.json({
      message: 'Repository ingested successfully',
      data: {
        tree,
        content,
        normalized: output,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to process repository',
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (tempDir) {
      await removeTempDir(tempDir);
    }
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(
    `Server is running on port ${process.env.PORT || 3000} in ${process.env.NODE_ENV} mode`,
  );
});
