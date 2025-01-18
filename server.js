// server.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env

const app = express();
const PORT = process.env.PORT || 3000;

// Spotify API configuration – ensure these values are in your .env file
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'YOUR_SPOTIFY_CLIENT_SECRET';

// Set up Multer for file uploads (accept one file per request)
const upload = multer({ dest: 'uploads/' });

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Utility: Get Spotify access token using the Client Credentials flow
async function getSpotifyToken() {
  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Error fetching Spotify token:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Utility: Search for a track in Spotify and return its preview_url
async function getSpotifyPreviewUrl(title, artist, accessToken) {
  if (!accessToken) return null;
  try {
    const query = encodeURIComponent(`track:${title} artist:${artist}`);
    const response = await axios.get(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const items = response.data.tracks.items;
    if (items && items.length > 0) {
      return items[0].preview_url; // Typically returns a 30-second preview snippet
    }
    return null;
  } catch (error) {
    console.error('Error searching Spotify:', error.response ? error.response.data : error.message);
    return null;
  }
}

// POST endpoint to handle analysis (song & caption generation)
app.post('/analyze', upload.single('photo'), async (req, res) => {
  try {
    // Check if file was provided (simulate file analysis)
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded.' });
    }
    // Retrieve form data
    const { postType, regenerate } = req.body; // postType is either "post" or "story"

    // --------------
    // Step 1: Simulate Gemini API call
    // --------------
    // Simulate analysis of the photo to produce a recommendation.
    // In production, replace this with a real call to your Gemini API.
    let recommendedSong, customSong, caption;
    
    // For simulation, we "analyze" the file name (or use randomness)
    if (regenerate === 'song' || regenerate === 'caption' || Math.random() > 0.2) {
      // Most of the time, we use this sample recommendation
      recommendedSong = {
        title: "Shape of You",
        artist: "Ed Sheeran"
      };
      // Randomly decide if we should generate a custom song (simulate custom audio generation)
      customSong = Math.random() > 0.5;
      // Provide a caption if the mode is post
      if (postType === 'post') {
        caption = "Embracing the rhythm of the moment.";
      }
    } else {
      // Alternatively, simulate another song recommendation
      recommendedSong = {
        title: "Blinding Lights",
        artist: "The Weeknd"
      };
      customSong = false;
      if (postType === 'post') {
        caption = "Let your vibes shine bright!";
      }
    }

    // --------------
    // Step 2: Retrieve an audio preview
    // --------------
    let chorusUrl = null;
    if (customSong) {
      // Simulate custom audio generation based on the vibe
      // Replace the URL below with a call to your own custom audio generation service as needed.
      chorusUrl = "https://www.sample-videos.com/audio/mp3/wave.mp3";
      console.log("Using custom generated audio snippet.");
    } else {
      // Otherwise, use Spotify to get a preview snippet.
      const accessToken = await getSpotifyToken();
      chorusUrl = await getSpotifyPreviewUrl(recommendedSong.title, recommendedSong.artist, accessToken);
      console.log("Using Spotify track preview.");
    }
    // Use a fallback URL if none found
    if (!chorusUrl) {
      chorusUrl = "https://www.sample-videos.com/audio/mp3/crowd-cheering.mp3";
    }
    recommendedSong.chorusUrl = chorusUrl;

    // Return the data to the client
    res.json({
      recommendedSong,
      caption,
      postType
    });
  } catch (error) {
    console.error("Error processing analyze request:", error.message);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
