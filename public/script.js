// script.js

document.addEventListener('DOMContentLoaded', function() {
  const uploadForm = document.getElementById('uploadForm');
  const resultDiv = document.getElementById('result');
  const songDetails = document.getElementById('song-details');
  const captionSection = document.getElementById('caption-section');
  const captionText = document.getElementById('captionText');
  const audioPreview = document.getElementById('audioPreview');
  const regenerateSongBtn = document.getElementById('regenerateSong');
  const regenerateCaptionBtn = document.getElementById('regenerateCaption');

  uploadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(uploadForm);
    
    // Hide previous result if any
    resultDiv.classList.add('hidden');

    try {
      const response = await fetch('/analyze', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        throw new Error('Failed to analyze image');
      }
      const data = await response.json();
      displayResult(data);
    } catch (error) {
      alert(error.message);
      console.error(error);
    }
  });

  // Regenerate Song Button
  regenerateSongBtn.addEventListener('click', async function() {
    await regenerateContent({ type: 'song' });
  });

  // Regenerate Caption Button
  regenerateCaptionBtn.addEventListener('click', async function() {
    await regenerateContent({ type: 'caption' });
  });

  async function regenerateContent({ type }) {
    // For demo purposes, we simply resubmit the form data with a query parameter for regeneration.
    // In a real implementation, you might have separate endpoints or parameters.
    const formData = new FormData(uploadForm);
    formData.append('regenerate', type);
    try {
      const response = await fetch('/analyze', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        throw new Error('Failed to regenerate ' + type);
      }
      const data = await response.json();
      if (type === 'song') {
        updateSong(data.recommendedSong);
        if (data.postType === 'post' && data.caption) {
          // Also update caption if available, or leave caption as is if not regenerated.
          updateCaption(data.caption);
        }
      } else if (type === 'caption') {
        updateCaption(data.caption);
      }
    } catch (error) {
      alert(error.message);
      console.error(error);
    }
  }

  function displayResult(data) {
    // Update Song Section
    updateSong(data.recommendedSong);
    
    // If mode is post, update caption section
    if (data.postType === 'post') {
      updateCaption(data.caption);
      captionSection.classList.remove('hidden');
    } else {
      captionSection.classList.add('hidden');
    }

    // Show results
    resultDiv.classList.remove('hidden');
  }

  function updateSong(song) {
    // Display title and artist
    songDetails.innerHTML = `<strong>${song.title}</strong> by ${song.artist}`;
    // Set audio src to the chorus snippet URL
    audioPreview.src = song.chorusUrl;
    audioPreview.play();
  }

  function updateCaption(text) {
    captionText.innerText = text;
  }
});
