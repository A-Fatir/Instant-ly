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

// Enable CORS for all routes (adjust as needed)
app.use(cors());

// Spotify API configuration – these should be set via environment variables
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'YOUR_SPOTIFY_CLIENT_SECRET';

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Use memory storage for uploads (important in Vercel's serverless environment)
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
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const items = response.data.tracks.items;
    if (items && items.length > 0) {
      console.log("Spotify preview found.");
      return items[0].preview_url;
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

// POST endpoint to handle image analysis and recommendation
app.post('/analyze', upload.single('photo'), async (req, res) => {
  try {
    // Check that a file was uploaded
    if (!req.file) {
      console.error("No file uploaded.");
      return res.status(400).json({ error: 'No photo uploaded.' });
    }
    console.log("File received:", req.file.originalname);

    // Retrieve additional parameters from the request
    const { postType, regenerate } = req.body;  // postType: "post" or "story"

    // Convert the file buffer to a Base64 string (you might want to limit its length)
    const imageBase64 = req.file.buffer.toString('base64');

    // Prepare the Gemini API request payload.
    // The prompt instructs Gemini to analyze the vibe of the image (provided as a truncated Base64 string)
    // and return JSON with recommendedSong, customSong, and caption if applicable.
    const geminiPayload = {
      prompt: `
        Analyze the sentiment and vibe of the following image (Base64, truncated) and return a JSON object with:
        - recommendedSong: an object with keys "title" and "artist" representing a song that matches the vibe.
        - customSong: a boolean indicating whether a custom audio snippet should be generated.
        ${postType === 'post' ? '- caption: a suggested caption that fits the photo\'s vibe.' : ''}
        Image snippet: ${imageBase64.substring(0, 100)}...
        Return ONLY valid JSON.
      `,
      parameters: { postType, regenerate: regenerate || false }
    };

    console.log("Calling Gemini API...");
    // Call Gemini by including the API key in the query string
    const geminiResponse = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      geminiPayload,
      { headers: { "Content-Type": "application/json" } }
    );
    console.log("Gemini API response received:", geminiResponse.data);

    // Parse Gemini's response
    let { recommendedSong, customSong, caption } = geminiResponse.data;
    if (!recommendedSong || !recommendedSong.title || !recommendedSong.artist) {
      console.error("Gemini API did not return a valid song recommendation.");
      return res.status(500).json({ error: "Invalid response from image analysis." });
    }

    // Step 2: Retrieve the audio preview
    let chorusUrl = null;
    if (customSong) {
      // Here you would integrate your custom audio generation service.
      // For now, we use a placeholder URL.
      chorusUrl = "https://www.your-custom-audio-service.com/path/to/generated/audio.mp3";
      console.log("Using custom generated audio snippet.");
    } else {
      // Use Spotify to try to retrieve a preview snippet.
      const accessToken = await getSpotifyToken();
      chorusUrl = await getSpotifyPreviewUrl(recommendedSong.title, recommendedSong.artist, accessToken);
      console.log("Using Spotify track preview.");
    }
    if (!chorusUrl) {
      chorusUrl = "https://www.sample-videos.com/audio/mp3/crowd-cheering.mp3";
      console.log("Using fallback audio snippet.");
    }
    recommendedSong.chorusUrl = chorusUrl;

    // Return the final result to the client
    res.json({
      recommendedSong,
      caption,
      postType
    });
  } catch (error) {
    console.error("Error processing analyze request:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: "Failed to analyze image", details: error.response ? error.response.data : error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
