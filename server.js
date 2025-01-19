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

// Enable CORS for all routes
app.use(cors());

// Spotify API configuration – set these via environment variables
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'YOUR_SPOTIFY_CLIENT_SECRET';

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Multer: use memory storage so we don't try to write to disk in serverless environments
const upload = multer({ storage: multer.memoryStorage() });

// Serve static files from "public"
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Utility: Fetch Spotify token using the Client Credentials flow
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

// Utility: Given a track title & artist, returns a Spotify 30-second preview URL if available
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
      return items[0].preview_url;  // Typically a 30-second preview
    }
    console.log("No preview available from Spotify.");
    return null;
  } catch (error) {
    console.error("Error searching Spotify:", error.response ? error.response.data : error.message);
    return null;
  }
}

// POST /analyze -> analyze uploaded photo with Gemini, recommend a song + caption
app.post('/analyze', upload.single('photo'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      console.error("No file uploaded.");
      return res.status(400).json({ error: 'No photo uploaded.' });
    }
    console.log("File received:", req.file.originalname);

    // Read form data
    const { postType, regenerate } = req.body;

    // Convert to Base64
    const imageBase64 = req.file.buffer.toString('base64');
    // Build prompt for Gemini
    const promptArray = [
      { mime_type: 'image/jpeg', data: imageBase64 },  // If it's HEIC or PNG, change accordingly
      postType === 'post'
        ? "Analyze the sentiment of this image and return valid JSON with recommendedSong {title, artist}, customSong boolean, and a caption."
        : "Analyze the sentiment of this image and return valid JSON with recommendedSong {title, artist} and a customSong boolean."
    ];

    const geminiPayload = {
      prompt: promptArray,
      parameters: { regenerate: regenerate || false }
    };

    console.log("Calling Gemini API...");
    // Call the Gemini endpoint with our API key as a query param
    const geminiResponse = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      geminiPayload,
      { headers: { "Content-Type": "application/json" } }
    );
    console.log("Gemini API response received:", geminiResponse.data);

    let { recommendedSong, customSong, caption } = geminiResponse.data;
    if (!recommendedSong || !recommendedSong.title || !recommendedSong.artist) {
      console.error("Gemini API did not return a valid song recommendation.");
      return res.status(500).json({ error: "Invalid response from image analysis." });
    }

    // If Gemini suggests a custom audio snippet, use a placeholder URL
    let chorusUrl = null;
    if (customSong) {
      chorusUrl = "https://www.your-custom-audio-service.com/path/to/generated/audio.mp3";
      console.log("Using custom generated audio snippet.");
    } else {
      // Otherwise, fetch a Spotify preview
      const accessToken = await getSpotifyToken();
      chorusUrl = await getSpotifyPreviewUrl(recommendedSong.title, recommendedSong.artist, accessToken);
      console.log("Using Spotify track preview.");
    }

    // Fallback if no preview available
    if (!chorusUrl) {
      chorusUrl = "https://www.sample-videos.com/audio/mp3/crowd-cheering.mp3";
      console.log("Using fallback audio snippet.");
    }
    recommendedSong.chorusUrl = chorusUrl;

    // Return the final result
    res.json({ recommendedSong, caption, postType });
  } catch (error) {
    console.error("Error processing analyze request:", error.response ? error.response.data : error.message);
    res.status(500).json({
      error: "Failed to analyze image",
      details: error.response ? error
