// Backend Code (Node.js with Express)

const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Gemini API credentials
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=GEMINI_API_KEY";
const GEMINI_API_KEY = "AIzaSyAiZXeOU33LOi9Ffdr6dvRnl20OENTat5I";

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

