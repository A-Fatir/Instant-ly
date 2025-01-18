// server.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
require('dotenv').config(); // To load environment variables from .env

const app = express();
const PORT = process.env.PORT || 3000;

// Spotify API configuration – be sure to set these values in your .env file
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'YOUR_SPOTIFY_CLIENT_ID';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'YOUR_SPOTIFY_CLIENT_SECRET';

// Set up Multer for file uploads (only accept a single file from the form)
const upload = multer({ dest: 'uploads/' });

// Serve static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Get Spotify access token using the Client Credentials flow
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
    throw new Error('Could not get Spotify access token');
  }
}

// Search for a track in Spotify and return its preview_url
async function getSpotifyPreviewUrl(title, artist, accessToken) {
  try {
    // Build query string: search for track title and artist
    const q = encodeURIComponent(`track:${title} artist:${artist}`);
    const response = await axios.get(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const items = response.data.tracks.items;
    if (items.length > 0) {
      return items[0].preview_url; // Typically a 30-second preview
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
    // Retrieve form data (postType: "post" or "story")
    const { postType, regenerate } = req.body;

    // -------------------------------
    // Step 1: Call Gemini API simulation
    // -------------------------------
    const geminiData = {
      // The Gemini prompt is built to analyze the photo and return song details + caption.
      prompt: "Analyze the photo and return a song recommendation with title and artist. Also, indicate whether the song should be a custom audio generation (based on the vibe) or an existing match. For 'post', return a caption as well. Return a JSON like { recommendedSong: { title, artist }, customSong: <true/false>, caption: <text> }.",
      parameters: {
        postType,
        regenerate: regenerate || false,
      },
    };

    // Call the Gemini API endpoint
    // (For demonstration purposes, this call is simulated. You would use your actual Gemini API call.)
    const geminiResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      geminiData,
      {
        params: {
          key: 'AIzaSyAiZXeOU33LOi9Ffdr6dvRnl20OENTat5I',
        },
      }
    );

    // Simulated response handling – in production, use geminiResponse.data directly.
    let { recommendedSong, customSong, caption } = geminiResponse.data;
    if (!recommendedSong) {
      // Provide a sample default if the API did not return one
      recommendedSong = {
        title: "Shape of You",
        artist: "Ed Sheeran",
      };
    }
    // Simulate customSong flag if not provided (for demonstration, we'll randomly choose)
    if (typeof customSong === "undefined") {
      customSong = Math.random() > 0.5;  // 50/50 chance – replace with your actual logic.
    }
    if (postType === 'post' && !caption) {
      caption = "Embracing the rhythm of the moment.";
    }

    // -------------------------------
    // Step 2: Retrieve an audio preview
    // -------------------------------
    let chorusUrl = null;
    // If Gemini suggests a custom song, simulate custom audio generation.
    if (customSong) {
      // Simulate custom audio generation based on the vibe of the photo.
      // Replace the URL below with a call to your custom audio generation service.
      chorusUrl = "https://www.sample-videos.com/audio/mp3/wave.mp3";
      console.log("Using custom generated audio snippet.");
    } else {
      // Otherwise, try to get a matching song from Spotify.
      try {
        const accessToken = await getSpotifyToken();
        chorusUrl = await getSpotifyPreviewUrl(recommendedSong.title, recommendedSong.artist, accessToken);
        console.log("Using Spotify track preview.");
      } catch (spotifyError) {
        console.error("Spotify integration error:", spotifyError.message);
      }
    }
    // Fallback: if no preview URL is found, use a default sample.
    if (!chorusUrl) {
      chorusUrl = "https://www.sample-videos.com/audio/mp3/crowd-cheering.mp3";
    }
    recommendedSong.chorusUrl = chorusUrl;

    // Return the merged response to the front end.
    res.json({
      recommendedSong,
      caption,
      postType,
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
