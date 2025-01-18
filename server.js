// server.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const cors = require('cors'); // Enable CORS
require('dotenv').config();  // Load environment variables from .env

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes (adjust if needed)
app.use(cors());

// Spotify API configuration – these should be set in your Vercel environment variables
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'YOUR_SPOTIFY_CLIENT_SECRET';

// Use memory storage for uploads (serverless functions have read-only file systems)
const upload = multer({ storage: multer.memoryStorage() });

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
          'Authorization': `Basic ${credentials}`
        },
      }
    );
    console.log("Spotify token acquired.");
    return response.data.access_token;
  } catch (error) {
    console.error(
      'Error fetching Spotify token:',
      error.response ? error.response.data : error.message
    );
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
      console.log("Spotify preview found.");
      return items[0].preview_url; // Typically returns a 30-second preview snippet
    }
    console.log("No preview available from Spotify.");
    return null;
  } catch (error) {
    console.error(
      'Error searching Spotify:',
      error.response ? error.response.data : error.message
    );
    return null;
  }
}

// POST endpoint to handle analysis (song & caption generation)
app.post('/analyze', upload.single('photo'), async (req, res) => {
  try {
    // Check if file was provided.
    // When using memory storage, the file is in req.file.buffer.
    if (!req.file) {
      console.error("No file uploaded.");
      return res.status(400).json({ error: 'No photo uploaded.' });
    }
    console.log("File received. Original name:", req.file.originalname);
    
    // Retrieve form data
    const { postType, regenerate } = req.body; // postType: "post" or "story"

    // --------------
    // Step 1: Simulate Gemini API call
    // --------------
    let recommendedSong, customSong, caption;
    
    // In our simulation, we use randomness to decide the response.
    if (regenerate === 'song' || regenerate === 'caption' || Math.random() > 0.2) {
      // Default simulated recommendation
      recommendedSong = {
        title: "Shape of You",
        artist: "Ed Sheeran"
      };
      // Randomly decide if we should simulate a custom audio generation
      customSong = Math.random() > 0.5;
      if (postType === 'post') {
        caption = "Embracing the rhythm of the moment.";
      }
      console.log("Simulated recommendation: Shape of You by Ed Sheeran.", "customSong:", customSong);
    } else {
      // Alternative recommendation
      recommendedSong = {
        title: "Blinding Lights",
        artist: "The Weeknd"
      };
      customSong = false;
      if (postType === 'post') {
        caption = "Let your vibes shine bright!";
      }
      console.log("Simulated recommendation: Blinding Lights by The Weeknd.");
    }

    // --------------
    // Step 2: Retrieve an audio preview
    // --------------
    let chorusUrl = null;
    if (customSong) {
      // Simulate a custom audio generation URL.
      chorusUrl = "https://www.sample-videos.com/audio/mp3/wave.mp3";
      console.log("Using simulated custom generated audio snippet.");
    } else {
      // Otherwise, attempt to get a preview snippet from Spotify.
      const accessToken = await getSpotifyToken();
      chorusUrl = await getSpotifyPreviewUrl(recommendedSong.title, recommendedSong.artist, accessToken);
      console.log("Using Spotify track preview.");
    }
    // Use a fallback URL if no preview was found.
    if (!chorusUrl) {
      chorusUrl = "https://www.sample-videos.com/audio/mp3/crowd-cheering.mp3";
      console.log("Using fallback audio snippet.");
    }
    recommendedSong.chorusUrl = chorusUrl;

    // Return the result to the client
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
