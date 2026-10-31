const url = new URL(window.location.href);
// Keycloakify reloads when its page template is mounted more than once outside docs mode.
url.searchParams.set("viewMode", "docs");
window.history.replaceState(window.history.state, "", url);

// Prevent form submissions from reloading the iframe during tests
window.addEventListener(
    "submit",
    event => {
        event.preventDefault();
    },
    true
);
