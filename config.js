// Frontend API base URL configuration
// Set window.API_URL to your deployed backend URL for GitHub Pages.
// Defaults to local Flask dev server for local development.
(function () {
	if (typeof window !== 'undefined' && !window.API_URL) {
		window.API_URL = 'http://127.0.0.1:5000';
	}
})();

