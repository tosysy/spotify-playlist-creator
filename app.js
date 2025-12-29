class SpotifyPlaylistCreator {
    constructor() {
        this.auth = new SpotifyAuth();
        this.apiBase = 'https://api.spotify.com/v1';
        this.searchTimeout = null;
        this.currentArtist = null;
        
        this.init();
    }

    init() {
        if (this.auth.handleCallback() || this.auth.loadToken()) {
            this.showScreen('search-screen');
        } else {
            this.showScreen('login-screen');
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('login-button').addEventListener('click', () => {
            this.auth.login();
        });

        document.getElementById('logout-button').addEventListener('click', () => {
            this.auth.logout();
            this.showScreen('login-screen');
        });

        const searchInput = document.getElementById('search-input');
        const clearBtn = document.getElementById('clear-search');

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearBtn.classList.toggle('visible', query.length > 0);

            clearTimeout(this.searchTimeout);
            
            if (query.length === 0) {
                this.showEmptyState();
                return;
            }

            this.showLoadingState();
            
            this.searchTimeout = setTimeout(() => {
                this.searchArtists(query);
            }, 300);
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.remove('visible');
            this.showEmptyState();
            searchInput.focus();
        });

        document.getElementById('create-another-btn').addEventListener('click', () => {
            this.showScreen('search-screen');
        });

        document.getElementById('retry-button').addEventListener('click', () => {
            this.showScreen('search-screen');
        });
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    showEmptyState() {
        document.getElementById('empty-state').classList.remove('hidden');
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('no-results-state').classList.add('hidden');
        document.getElementById('artists-list').classList.add('hidden');
    }

    showLoadingState() {
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('loading-state').classList.remove('hidden');
        document.getElementById('no-results-state').classList.add('hidden');
        document.getElementById('artists-list').classList.add('hidden');
    }

    showNoResultsState(query) {
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('no-results-state').classList.remove('hidden');
        document.getElementById('artists-list').classList.add('hidden');
        document.getElementById('no-results-query').textContent = `No hay artistas para "${query}"`;
    }

    showArtistsList() {
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('no-results-state').classList.add('hidden');
        document.getElementById('artists-list').classList.remove('hidden');
    }

    async apiRequest(endpoint, options = {}) {
        const response = await fetch(`${this.apiBase}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.auth.getToken()}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.auth.logout();
                this.showScreen('login-screen');
                throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
            }
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    async searchArtists(query) {
        try {
            const data = await this.apiRequest(`/search?q=${encodeURIComponent(query)}&type=artist&limit=20`);
            
            if (data.artists.items.length === 0) {
                this.showNoResultsState(query);
                return;
            }

            this.displayArtists(data.artists.items);
        } catch (error) {
            console.error('Error searching artists:', error);
            this.showError(error.message);
        }
    }

    displayArtists(artists) {
        const listContainer = document.getElementById('artists-list');
        listContainer.innerHTML = '';

        artists.forEach(artist => {
            const card = this.createArtistCard(artist);
            listContainer.appendChild(card);
        });

        this.showArtistsList();
    }

    createArtistCard(artist) {
        const card = document.createElement('div');
        card.className = 'artist-card';
        
        const imageUrl = artist.images[0]?.url || '';
        const genres = artist.genres?.slice(0, 2).join(', ') || '';
        const followers = this.formatFollowers(artist.followers?.total || 0);

        card.innerHTML = `
            <img src="${imageUrl}" alt="${artist.name}" class="artist-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27100%27 height=%27100%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%23282828%27 width=%27100%27 height=%27100%27/%3E%3C/svg%3E'">
            <div class="artist-info">
                <div class="artist-name">${artist.name}</div>
                ${genres ? `<div class="artist-genres">${genres}</div>` : ''}
                <div class="artist-followers">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    ${followers}
                </div>
            </div>
            <svg class="artist-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        `;

        card.addEventListener('click', () => this.createPlaylistForArtist(artist));

        return card;
    }

    formatFollowers(count) {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M seguidores`;
        } else if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K seguidores`;
        }
        return `${count} seguidores`;
    }

    async createPlaylistForArtist(artist) {
        this.currentArtist = artist;
        this.showScreen('creating-screen');
        document.getElementById('creating-artist-name').textContent = `Buscando canciones de ${artist.name}`;
        document.getElementById('creating-progress').textContent = '';

        try {
            const user = await this.apiRequest('/me');

            document.getElementById('creating-progress').textContent = 'Analizando tu biblioteca...';
            const tracks = await this.getAllArtistTracks(artist.id);

            if (tracks.length === 0) {
                throw new Error(`No tienes canciones de ${artist.name} en tu biblioteca`);
            }

            document.getElementById('creating-progress').textContent = `Encontradas ${tracks.length} canciones. Creando playlist...`;

            const playlist = await this.apiRequest(`/users/${user.id}/playlists`, {
                method: 'POST',
                body: JSON.stringify({
                    name: `${artist.name} - Mi Colección`,
                    description: `Creada automáticamente • ${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'} de ${artist.name}`,
                    public: false
                })
            });

            document.getElementById('creating-progress').textContent = 'Añadiendo canciones...';

            const trackUris = tracks.map(t => t.uri);
            for (let i = 0; i < trackUris.length; i += 100) {
                const batch = trackUris.slice(i, i + 100);
                await this.apiRequest(`/playlists/${playlist.id}/tracks`, {
                    method: 'POST',
                    body: JSON.stringify({ uris: batch })
                });
            }

            this.showSuccess(playlist, tracks.length);
        } catch (error) {
            console.error('Error creating playlist:', error);
            this.showError(error.message);
        }
    }

    async getAllArtistTracks(artistId) {
        const allTracks = [];
        let offset = 0;
        const limit = 50;
        let hasMore = true;

        while (hasMore) {
            const data = await this.apiRequest(`/me/tracks?limit=${limit}&offset=${offset}`);
            
            const artistTracks = data.items
                .filter(item => item.track.artists.some(a => a.id === artistId))
                .map(item => item.track);
            
            allTracks.push(...artistTracks);
            
            offset += limit;
            hasMore = data.next !== null;
        }

        return allTracks;
    }

    showSuccess(playlist, tracksCount) {
        document.getElementById('success-playlist-name').textContent = playlist.name;
        document.getElementById('success-tracks-count').textContent = 
            `${tracksCount} ${tracksCount === 1 ? 'canción añadida' : 'canciones añadidas'}`;
        
        const openBtn = document.getElementById('open-spotify-btn');
        openBtn.href = playlist.external_urls.spotify;

        this.showScreen('success-screen');
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        this.showScreen('error-screen');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SpotifyPlaylistCreator();
});
