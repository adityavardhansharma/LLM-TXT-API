# LLM-TXT_API

A service that ingests and analyzes Git repositories, providing their structure and content in a standardized format. This API allows you to easily extract and analyze the contents of any public Git repository.

## Prerequisites

- Node.js (v14 or higher)
- npm or pnpm package manager

## Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/prudentbird/repogist-api.git](https://github.com/adityavardhansharma/LLM-TXT-API.git
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
npm run build
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
    "index": [
      {
        "fileName": "path/to/file",
        "fileContent": "file contents..."
      }
    ],
    "normalized": "Combined output..."
  }
}
```

**Error Responses:**

```json
{
  "error": "Invalid Git repository URL",
  "message": "The provided URL is not a valid Git repository URL"
}
```

```json
{
  "error": "Request timeout",
  "message": "The request took too long to process. Please try again."
}
```

### Supported URL Formats

- GitHub URLs:
  - `https://github.com/username/repo`
  - `https://github.com/username/repo/tree/branch`
- GitLab URLs:
  - `https://gitlab.com/username/repo`
  - `https://gitlab.com/username/repo/-/tree/branch`
- Git URLs:
  - `git@github.com:username/repo.git`
  - `https://github.com/username/repo.git`

### Default Ignored Files

The service automatically ignores common lock files and debug logs:

- Package manager lock files:
  - `*.lock`
  - `package-lock.json`
  - `yarn.lock`
  - `pnpm-lock.yaml`
  - `Gemfile.lock`
  - `Cargo.lock`
  - `composer.lock`
  - `poetry.lock`
  - `go.sum`
  - `bun.lockb`
- Debug logs:
  - `npm-debug.log*`
  - `yarn-debug.log*`
  - `yarn-error.log*`

### Limitations

- Maximum repository size: 300MB
- Request timeout: 30 seconds
- Binary files are automatically skipped
- Only public repositories are supported

### Environment Variables

| Variable | Description      | Default     |
| -------- | ---------------- | ----------- |
| PORT     | Server port      | 3000        |
| NODE_ENV | Environment mode | development |

**Note:** You need to create a `.env` file in the base directory of the project to set these environment variables.

## Contributing

Contributions are encouraged! If you find a major bug or have improvements, feel free
to open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Author

Created by [adityavardhansharma](https://github.com/adityavardhansharma) (Aditya Vardhan Sharma)
