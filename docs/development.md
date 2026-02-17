# Development & Build Guide

This guide covers how to build, package, and release the AG Insights extension.

## Development Setup

To build and package this extension yourself:

1. **Install Dependencies**:

    ```bash
    npm install
    ```

2. **Compile**:

    ```bash
    npm run compile
    ```

3. **Package (.vsix)**:

    ```bash
    npx vsce package
    ```

    This will generate an `ag-insights-x.x.x.vsix` file in the project root.

## Release Process

We use an automated release process using GitHub Actions.

### Triggering a Release

To create a new release:

1. **Increment Version & Tag**:
    Run the following command to increment the patch version, create a commit, and tag the release:

    ```bash
    npm run release
    ```

2. **Push Changes**:
    Push the new commit and the tag to GitHub:

    ```bash
    git push && git push --tags
    ```

### Automation

A GitHub Action (`.github/workflows/release.yml`) listens for new tags. When a tag is pushed:

1. It checks out the code.
2. Builds the extension.
3. Packages it into a `.vsix`.
4. Creates a new Release on GitHub with the `.vsix` file attached.
