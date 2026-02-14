
# MMM-CTFd

A MagicMirror² module that displays live scoreboard and team standings from a CTFd instance (CTFd.io). Designed to show the current leaderboard, team scores, and optional details on your MagicMirror.

Screenshot will be published later:

![Screenshot](screenshot.png)

## Installation

1. Navigate to your MagicMirror's `modules` directory.
2. Clone this repository:
	 ```sh
	 git clone https://github.com/ItsMeBrille/MMM-CTFd.git
	 ```

## Configuration

Add the module to the `modules` array in your MagicMirror `config/config.js`:

```javascript
{
	module: "MMM-CTFd",
	position: "top_right",
	config: {
    CTFd_URL: "https://demo.ctfd.io", // CTFd instance URL
    CTFd_token: "",                   // CTFd API token
    updateInterval: 180,              // seconds between refreshes (3 minutes)
    showTop: 10,                      // max leaderboard rows
    showCategories: true,             // show stacked category bars
    showFirstBloods: false,           // show first blood indicator
    showStats: false,                 // show the three stat boxes
    username: "",                     // username to always include on leaderboard
  }
}
```

## Troubleshooting

- For CTFd instances behind auth, create a user with appropriate permissions and generate an access token and use that as `CTFd_token` in the configuration.
- Verify the `CTFd_URL` is reachable from the machine actually running your MagicMirror, and that both scoreboard and challenges are either public or accessible with the provided token.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
