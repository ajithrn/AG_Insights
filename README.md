# AG Insights

A VS Code extension for Antigravity IDE that monitors your AI model quota usage in real-time.

## Features

- **Real-time Quota Monitoring**: Displays your current quota usage in the status bar.
- **Hover for Details**: Hover over the **AG Insights** status bar item to see detailed information for all models.
- **Prompt Credits**: Tracks your prompt credit usage and remaining balance.
- **Auto-Refresh**: Automatically updates quota information at a configurable interval.

- **Secure & Private**: Only communicates with the local Antigravity process on your machine. No data is sent to external servers.

## Installation

To install the extension:

1. **Download the latest release**:
    Go to the [Releases page](https://github.com/ajithrn/AG_Insights/releases) and download the `.vsix` file from the latest release.

2. **Install in Antigravity IDE**:
    1. Open **Antigravity IDE**.
    2. Go to the **Extensions** view (`Cmd+Shift+X` or `Ctrl+Shift+X`).
    3. Click the **... (Views and More Actions)** menu at the top-right of the Extensions pane.
    4. Select **Install from VSIX...**.
    5. Navigate to and select the downloaded `.vsix` file.

## Usage

1. **Install the Extension**: Install the `.vsix` package in Antigravity IDE.
2. **View Quota**: Look at the bottom right status bar for the "AG Insights" item.
3. **Refresh Quota**: Click the status bar item to manually refresh your stats.
4. **See Details**: Hover over the status bar item to see a detailed breakdown for all models.

## Configuration

You can configure the extension in VS Code settings under `agInsights`:

- `agInsights.enabled`: Enable/disable monitoring (default: `true`)
- `agInsights.pollingInterval`: How often to check quota in milliseconds (default: `300000` - 5 minutes)
- `agInsights.showPromptCredits`: Show prompt credits in status bar (default: `true`)
- `agInsights.pinnedModels`: List of model IDs to show in status bar

## Troubleshooting

If the extension doesn't show quota information:

1. Ensure Antigravity IDE is running and you are logged in.
2. Check the "AG Insights" output channel for logs.
3. Try the "AG Insights: Reconnect" command.

## License

MIT

## Development

For instructions on building, packaging, and releasing the extension, please see [Development Guide](docs/development.md).
