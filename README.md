# Repo Gist API

A service that ingests and analyzes Git repositories, providing their structure and content in a standardized format.

## Prerequisites

- Node.js (v14 or higher)

## Installation

1. Clone the repository:

```bash
git clone https://prudentbird/repogist-api.git
cd repogist-api
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
```

## Usage

Start the server:

```bash
npm start
```

### API Endpoints

#### POST /ingest

Ingest a Git repository and get its structure and content.

**Request Body:**

```json
{
  "url": "https://github.com/username/repo",
  "ignorePatterns": ["**/*.md", "**/node_modules/**"] // optional
}
```

**Response:**

```json
{
  "message": "Repository ingested successfully",
  "data": {
    "tree": "Repository tree structure...",
    "content": "Repository content...",
    "normalized": "Combined output..."
  }
}
```

## Supported URL Formats

- GitHub URLs:
  - `https://github.com/username/repo`
  - `https://github.com/username/repo/tree/branch`
- GitLab URLs:
  - `https://gitlab.com/username/repo`
  - `https://gitlab.com/username/repo/-/tree/branch`
- Git URLs:
  - `git@github.com:username/repo.git`
  - `https://github.com/username/repo.git`

## Default Ignored Files

The service automatically ignores common lock files and debug logs:

- Package manager lock files (\*.lock, package-lock.json, yarn.lock, etc.)
- Debug logs (npm-debug.log*, yarn-debug.log*, yarn-error.log\*)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are encouraged! If you find a major bug or have improvements, feel free to open an issue or submit a pull request.

## Author

Created by [Prudent Bird](https://github.com/prudentbird) • [X/Twitter](https://x.com/prudentbird)
