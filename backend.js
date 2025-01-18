const express = require('express');
const axios = require('axios');
const path = require('path'); // Add this line to import the 'path' module
const app = express();
const port = 3000;

app.use(express.json());

// Placeholder for Gemini API credentials
const GEMINI_API_URL = "https://api.example-gemini.com/generate";
const GEMINI_API_KEY = "your_gemini_api_key";

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Process Photo Endpoint
app.post('/process-photo', async (req, res) => {
    const { type, photo } = req.body;

    try {
        // Call Gemini API to generate song and caption
        const geminiResponse = await axios.post(GEMINI_API_URL, {
            type,
            photo
        }, {
            headers: {
                'Authorization': `Bearer ${GEMINI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = geminiResponse.data;

        if (type === 'post') {
            res.json({ song: data.song, caption: data.caption });
        } else {
            res.json({ song: data.song });
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        res.status(500).json({ error: "Failed to process the request." });
    }
});

// Regenerate Caption Endpoint
app.post('/regenerate-caption', async (req, res) => {
    try {
        // Call Gemini API for caption regeneration
        const geminiResponse = await axios.post(`${GEMINI_API_URL}/caption`, {}, {
            headers: {
                'Authorization': `Bearer ${GEMINI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({ newCaption: geminiResponse.data.newCaption });
    } catch (error) {
        console.error("Error regenerating caption:", error);
        res.status(500).json({ error: "Failed to regenerate caption." });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

