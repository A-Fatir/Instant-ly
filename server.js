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
        'Authorization': `Bearer ${accessToken}`,
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

    // Read the uploaded file buffer if necessary
    // (You might send image metadata or a Base64-encoded image as part of the prompt)
    const imageBase64 = req.file.buffer.toString('base64');

    // Prepare the Gemini API request payload
    const geminiPayload = {
      prompt: `
        Analyze the following image (encoded in Base64) and return a JSON object with:
        - recommendedSong: { title, artist }
        - customSong: a boolean indicating if a custom audio should be generated
        ${postType === 'post' ? "- caption: a suggested caption matching the photo's vibe" : ""}
      Image (Base64): ${imageBase64.substring(0,100)}... (truncated for prompt)
      `,
      parameters: {
        postType,
        regenerate: regenerate || false,
      }
    };

    // Call the Gemini API for analysis
    console.log("Calling Gemini API...");
    const geminiResponse = await axios.post(
      GEMINI_API_URL,
      geminiPayload,
      {
        params: {
          key: GEMINI_API_KEY
        }
      }
    );
    console.log("Gemini API response received.");

    // Expecting Gemini to return a structured JSON response.
    // For example:
    // {
    //    recommendedSong: { title: "Song Title", artist: "Artist Name" },
    //    customSong: true/false,
    //    caption: "A caption here" (if postType is 'post')
    // }
    let { recommendedSong, customSong, caption } = geminiResponse.data;
    if (!recommendedSong || !recommendedSong.title || !recommendedSong.artist) {
      console.error("Gemini API did not return a valid song recommendation.");
      return res.status(500).json({ error: "Invalid response from image analysis." });
    }

    // Step 2: Retrieve the audio preview
    let chorusUrl = null;
    if (customSong) {
      // If Gemini indicates a custom audio should be generated, you might call
      // your custom audio generation service here. For now, we'll assume Gemini provides a custom flag.
      // Replace this with actual custom audio generation logic if available.
      chorusUrl = "https://www.your-custom-audio-service.com/path/to/generated/audio.mp3";
      console.log("Using custom generated audio snippet (from your custom audio service).");
    } else {
      // Otherwise, attempt to retrieve a preview from Spotify.
      const accessToken = await getSpotifyToken();
      chorusUrl = await getSpotifyPreviewUrl(recommendedSong.title, recommendedSong.artist, accessToken);
      console.log("Using Spotify track preview.");
    }
    // Fallback if no chorusUrl is obtained
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
  console.error("Error processing analyze request:", error.response ? error.response.data : error.message);
  res.status(500).json({
    error: "Failed to analyze image",
    details: error.response ? error.response.data : error.message
  });
}
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
