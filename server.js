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

// Enable CORS
app.use(cors());

// Spotify API configuration – set these via environment variables
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'YOUR_SPOTIFY_CLIENT_SECRET';

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Use memory storage for uploads (important in serverless environments)
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
        }
      }
    );
    console.log("Spotify token acquired.");
    return response.data.access_token;
  } catch (error) {
    console.error("Error fetching Spotify token:", error.response ? error.response.data : error.message);
    return null;
  }
}

// Utility: Search for a track in Spotify and return its preview_url
async function getSpotifyPreviewUrl(title, artist, accessToken) {
  if (!accessToken) return null;
  try {
    const query = encodeURIComponent(`track:${title} artist:${artist}`);
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const items = response.data.tracks.items;
    if (items && items.length > 0) {
      console.log("Spotify preview found.");
      return items[0].preview_url;
    }
    console.log("No preview available from Spotify.");
    return null;
  } catch (error) {
    console.error("Error searching Spotify:", error.response ? error.response.data : error.message);
    return null;
  }
}

// POST /analyze: analyze uploaded photo and return song recommendation
app.post('/analyze', upload.single('photo'), async (req, res) => {
  try {
    // Verify a file was uploaded
    if (!req.file) {
      console.error("No file uploaded.");
      return res.status(400).json({ error: 'No photo uploaded.' });
    }
    console.log("File received:", req.file.originalname);

    // Retrieve additional parameters: postType ("post" or "story") and regenerate flag
    const { postType, regenerate } = req.body;

    // Convert the file buffer to a Base64 string. (Assuming the image is JPEG.)
    const imageBase64 = req.file.buffer.toString('base64');

    // Build the Gemini prompt as an array:
    // First element: an object with mime_type and data
    // Second element: a text instruction to analyze the image’s vibe and return a JSON with recommendedSong, customSong, and optionally caption.
    const promptArray = [
      { mime_type: 'image/jpeg', data: imageBase64 },
      postType === 'post'
        ? "Analyze the sentiment of this image and return valid JSON with a recommendedSong (with keys title and artist), a customSong boolean, and a caption that matches the vibe."
        : "Analyze the sentiment of this image and return valid JSON with a recommendedSong (with keys title and artist) and a customSong boolean."
    ];

    // Prepare payload for Gemini API call
    const geminiPayload = { prompt: promptArray, parameters: { regenerate: regenerate || false } };

    console.log("Calling Gemini API...");
    // Call Gemini API by attaching the API key as a query parameter
    const geminiResponse = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      geminiPayload,
      { headers: { "Content-Type": "application/json" } }
    );
    console.log("Gemini API response received.");

    // Gemini response should return valid JSON text.
    // For example: { "recommendedSong": { "title": "Song Title", "artist": "Artist Name" }, "customSong": true, "caption": "A caption here" }
    let { recommendedSong, customSong, caption } = geminiResponse.data;
    if (!recommendedSong || !recommendedSong.title || !recommendedSong.artist) {
      console.error("Gemini API did not return a valid song recommendation:", geminiResponse.data);
      return res.status(500).json({ error: "Invalid response from image analysis." });
    }

    // Retrieve an audio preview
    let chorusUrl = null;
    if (customSong) {
      // If a custom audio snippet is requested, replace this URL with the endpoint to your custom audio service.
      chorusUrl = "https://www.your-custom-audio-service.com/path/to/generated/audio.mp3";
      console.log("Using custom generated audio snippet.");
    } else {
      // Otherwise, use Spotify to try to retrieve a preview snippet.
      const accessToken = await getSpotifyToken();
      chorusUrl = await getSpotifyPreviewUrl(recommendedSong.title, recommendedSong.artist, accessToken);
      console.log("Using Spotify track preview.");
    }
    if (!chorusUrl) {
      chorusUrl = "https://www.sample-videos.com/audio/mp3/crowd-cheering.mp3";
      console.log("Using fallback audio snippet.");
    }
    recommendedSong.chorusUrl = chorusUrl;

    // Return the result to the client
    res.json({ recommendedSong, caption, postType });
  } catch (error) {
    console.error("Error processing analyze request:", error.response ? error.response.data : error.message);
    res.status(500).json({
      error: "Failed to analyze image",
      details: error.response ? error.response.data : error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
