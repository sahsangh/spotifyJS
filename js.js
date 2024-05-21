const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const querystring = require('querystring');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8888;

// Load your Spotify client credentials from the environment variables
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URI || 'http://localhost:8888/callback';
console.log('Client ID:', process.env.SPOTIFY_CLIENT_ID);
console.log('Client Secret:', process.env.SPOTIFY_CLIENT_SECRET);
console.log('Redirect URI:', process.env.REDIRECT_URI);

let accessToken = null;

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

app.get('/login', function(req, res) {
    const state = generateRandomString(16);
    const scope = 'user-read-private user-read-email user-top-read user-modify-playback-state';

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
});

app.get('/callback', async (req, res) => {
    const code = req.query.code || null;

    const authOptions = {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: querystring.stringify({
            code: code,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code'
        })
    };

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', authOptions);
        const data = await response.json();

        if (data.access_token) {
            accessToken = data.access_token;  // Store the access token
            const topTracks = await getTopTracks(data.access_token);
            console.log(topTracks);
            res.send('Top tracks fetched successfully. Check the server console.');
        } else {
            res.send('Error obtaining access token');
        }
    } catch (error) {
        console.error(error);
        res.send('Error during the request');
    }
});

async function fetchWebApi(endpoint, method, body, token) {
    const res = await fetch(`https://api.spotify.com/${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        method: method,
        body: body ? JSON.stringify(body) : null
    });

    // Check if the response status is 204 (No Content)
    if (res.status === 204) {
        return {}; // Return an empty object if there's no content
    }

    const data = await res.text(); // Get the response text

    // Try to parse the response as JSON
    try {
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to parse JSON:', data); // Log the response text for debugging
        throw error; // Re-throw the error to be handled by the calling function
    }
}

async function getTopTracks(token) {
    const data = await fetchWebApi(
        'v1/me/top/tracks?time_range=long_term&limit=5', 'GET', null, token
    );
    if (data && data.items) {
        const trackDetails = data.items.map(track => {
            const artistNames = track.artists.map(artist => artist.name).join(', ');
            return `${track.name} by ${artistNames}`;
        });
        return trackDetails;
    } else {
        console.log('No data found or no items available');
        return [];
    }
}

async function pausePlayback(token) {
    const endpoint = 'v1/me/player/pause';
    return await fetchWebApi(endpoint, 'PUT', null, token);
}

async function playPlayback(token) {
    const endpoint = 'v1/me/player/play';
    return await fetchWebApi(endpoint, 'PUT', null, token);
}

async function skipToNextTrack(token) {
    const endpoint = 'v1/me/player/next';
    return await fetchWebApi(endpoint, 'POST', null, token);
}

async function skipToPreviousTrack(token) {
    const endpoint = 'v1/me/player/previous';
    return await fetchWebApi(endpoint, 'POST', null, token);
}

app.get('/pause', async (req, res) => {
    if (!accessToken) {
        return res.status(400).send('Access token is required');
    }
    try {
        await pausePlayback(accessToken);
        res.send('Playback paused');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error pausing playback');
    }
});

app.get('/play', async (req, res) => {
    if (!accessToken) {
        return res.status(400).send('Access token is required');
    }
    try {
        await playPlayback(accessToken);
        res.send('Playback started');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error starting playback');
    }
});

app.get('/next', async (req, res) => {
    if (!accessToken) {
        return res.status(400).send('Access token is required');
    }
    try {
        await skipToNextTrack(accessToken);
        res.send('Skipped to next track');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error skipping to next track');
    }
});

app.get('/previous', async (req, res) => {
    if (!accessToken) {
        return res.status(400).send('Access token is required');
    }
    try {
        await skipToPreviousTrack(accessToken);
        res.send('Skipped to previous track');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error skipping to previous track');
    }
});

// Start the server on port 8888
app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
