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

  // Handle form submission: analyze the uploaded photo
  uploadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(uploadForm);
    
    // Hide previous results
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

  // Handle regenerate events
  regenerateSongBtn.addEventListener('click', async function() {
    await regenerateContent('song');
  });

  regenerateCaptionBtn.addEventListener('click', async function() {
    await regenerateContent('caption');
  });

  async function regenerateContent(type) {
    // Re-use the current form data and send a regeneration flag
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
    updateSong(data.recommendedSong);
    if (data.postType === 'post') {
      updateCaption(data.caption);
      captionSection.classList.remove('hidden');
    } else {
      captionSection.classList.add('hidden');
    }
    resultDiv.classList.remove('hidden');
  }

  function updateSong(song) {
    songDetails.innerHTML = `<strong>${song.title}</strong> by ${song.artist}`;
    audioPreview.src = song.chorusUrl;
    audioPreview.load();
    audioPreview.play();
  }

  function updateCaption(text) {
    captionText.innerText = text || '';
  }
});
