// CONFIGURACIÓN - Estos datos son de la app que crearé
const SPOTIFY_CONFIG = {
    clientId: 'TEMPORAL_HASTA_QUE_CREE_LA_APP',  // Lo actualizaré cuando Spotify reactive
    redirectUri: window.location.origin + window.location.pathname,
    scopes: [
        'user-library-read',
        'playlist-modify-private',
        'playlist-modify-public',
        'user-follow-read',
        'user-read-email'
    ]
};

class SpotifyAuth {
    constructor() {
        this.accessToken = null;
        this.tokenExpiresAt = null;
    }

    generateRandomString(length) {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const values = crypto.getRandomValues(new Uint8Array(length));
        return values.reduce((acc, x) => acc + possible[x % possible.length], '');
    }

    login() {
        const state = this.generateRandomString(16);
        localStorage.setItem('spotify_auth_state', state);

        const params = new URLSearchParams({
            client_id: SPOTIFY_CONFIG.clientId,
            response_type: 'token',
            redirect_uri: SPOTIFY_CONFIG.redirectUri,
            state: state,
            scope: SPOTIFY_CONFIG.scopes.join(' '),
            show_dialog: true
        });

        window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
    }

    handleCallback() {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);

        const accessToken = params.get('access_token');
        const state = params.get('state');
        const expiresIn = params.get('expires_in');
        const storedState = localStorage.getItem('spotify_auth_state');

        window.history.replaceState({}, document.title, window.location.pathname);

        if (accessToken && state === storedState) {
            this.accessToken = accessToken;
            this.tokenExpiresAt = Date.now() + (expiresIn * 1000);
            localStorage.setItem('spotify_access_token', accessToken);
            localStorage.setItem('spotify_token_expires', this.tokenExpiresAt);
            localStorage.removeItem('spotify_auth_state');
            return true;
        }

        return false;
    }

    loadToken() {
        const token = localStorage.getItem('spotify_access_token');
        const expiresAt = localStorage.getItem('spotify_token_expires');

        if (token && expiresAt && Date.now() < parseInt(expiresAt)) {
            this.accessToken = token;
            this.tokenExpiresAt = parseInt(expiresAt);
            return true;
        }

        this.logout();
        return false;
    }

    logout() {
        this.accessToken = null;
        this.tokenExpiresAt = null;
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_token_expires');
    }

    isAuthenticated() {
        return this.accessToken && Date.now() < this.tokenExpiresAt;
    }

    getToken() {
        return this.accessToken;
    }
}
