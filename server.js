// server.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up Multer for file uploads (we only accept a single file from the form)
const upload = multer({ dest: 'uploads/' });

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// POST endpoint to handle analysis requests
app.post('/analyze', upload.single('photo'), async (req, res) => {
  try {
    // Retrieve form data
    const { postType } = req.body; // either 'post' or 'story'
    // In a real-world scenario, you would also want to process the photo file
    // For simplicity, we will assume that the photo analysis is done via the Gemini API.
    
    // Prepare request data for the Gemini API
    // In practice, you might need to process the image (e.g. uploading it to an image recognition service)
    // and then include parameters such as sentiment detection.
    const geminiData = {
      // The content or parameters sent to Gemini based on the photo analysis
      prompt: "Analyze the photo and return a song recommendation with a snippet (the chorus) and a caption if it is for an Instagram post. For story, return a song recommendation only.",
      parameters: {
        postType: postType
        // Add more parameters if needed based on photo analysis.
      }
    };

    // Call the Gemini API
    const geminiResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      geminiData,
      {
        params: {
          key: 'AIzaSyAiZXeOU33LOi9Ffdr6dvRnl20OENTat5I'
        }
      }
    );

    // Simulated response processing
    // Assume geminiResponse.data contains fields: recommendedSong, caption
    // If it's a story, caption might be empty.
    let { recommendedSong, caption } = geminiResponse.data;
    
    // For the purposes of demonstration, if the Gemini API does not actually support this,
    // we simulate a response.
    if (!recommendedSong) {
      recommendedSong = {
        title: "Sample Song",
        artist: "Sample Artist",
        chorusUrl: "https://www.sample-videos.com/audio/mp3/crowd-cheering.mp3" // replace with an actual audio URL
      };
    }
    if (postType === 'post' && !caption) {
      caption = "A beautiful moment captured.";
    }

    // Return the response data to the frontend
    res.json({
      recommendedSong,
      caption,
      postType
    });

  } catch (error) {
    console.error("Error calling Gemini API: ", error.message);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
