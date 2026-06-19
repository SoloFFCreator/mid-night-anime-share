const express = require('express');
const app = express();

// Base URL of your active streaming app on Firebase
const FIREBASE_APP_URL = "https://mid-night-anime.web.app";

// Update this function if your streaming app handles watch routes differently
// Currently targets: https://mid-night-anime.web.app/watch?id=ANIME_ID&ep=EPISODE_NUMBER
function buildStreamingUrl(animeId, epId) {
    return `${FIREBASE_APP_URL}/watch?id=${animeId}&ep=${epId}`;
}

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';
const ANILIST_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    title {
      userPreferred
      english
    }
    coverImage {
      extraLarge
      large
    }
    description
  }
}`;

// Dynamic route matching: /anilist/:id/EP/:epId
app.get('/anilist/:id/EP/:epId', async (req, res) => {
    const animeId = parseInt(req.params.id, 10);
    const epId = req.params.epId;

    // Fallback meta values in case the AniList API fails or is slow
    let title = `Watch Anime Online - Episode ${epId}`;
    let imageUrl = "https://anilist.co/img/icons/icon.png"; 
    let description = "Stream your favorite anime episodes in high definition on Mid Night Anime.";

    if (!isNaN(animeId)) {
        try {
            const apiResponse = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: ANILIST_QUERY,
                    variables: { id: animeId }
                })
            });

            if (apiResponse.ok) {
                const jsonResult = await apiResponse.json();
                if (jsonResult.data && jsonResult.data.Media) {
                    const media = jsonResult.data.Media;
                    
                    // Set clean fallback chains for titles
                    title = `${media.title.userPreferred || media.title.english || 'Anime'} - Episode ${epId}`;
                    imageUrl = media.coverImage.extraLarge || media.coverImage.large;
                    
                    // Strip HTML formatting strings returned by AniList description fields
                    if (media.description) {
                        description = media.description
                            .replace(/<\/?[^>]+(>|$)/g, "")
                            .substring(0, 160) + "...";
                    }
                }
            }
        } catch (error) {
            console.error("AniList API Handshake Failed:", error);
        }
    }

    // Generate the destination link for the actual viewer
    const finalRedirectDestination = buildStreamingUrl(animeId, epId);

    // Set headers to prevent caching issues if details update on AniList
    res.setHeader('Cache-Control', 's-maxage=1200, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'text/html');

    // Return the response optimized heavily for WhatsApp scrapers
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <meta name="description" content="${description}">

            <meta property="og:type" content="video.other">
            <meta property="og:site_name" content="Mid Night Anime">
            <meta property="og:title" content="${title}">
            <meta property="og:description" content="${description}">
            <meta property="og:image" content="${imageUrl}">
            <meta property="og:image:secure_url" content="${imageUrl}">
            <meta property="og:image:type" content="image/jpeg">
            <meta property="og:image:width" content="1200">
            <meta property="og:image:height" content="675">
            
            <meta http-equiv="refresh" content="0;url=${finalRedirectDestination}">

            <style>
                body { margin: 0; background-color: #020617; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center; }
                .spinner-box { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
                .spinner { border: 4px solid #0f172a; border-top: 4px solid #6366f1; border-radius: 50%; width: 44px; height: 44px; animation: spin 0.8s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                h1 { font-size: 1.25rem; font-weight: 600; margin: 0; color: #cbd5e1; }
            </style>
        </head>
        <body>
            <div class="spinner-box">
                <div class="spinner"></div>
                <h1>Opening Player Context...</h1>
            </div>

            <script>
                // Instantly bounce the user over to the player UI on Firebase Hosting
                window.location.href = "${finalRedirectDestination}";
            </script>
        </body>
        </html>
    `);
});

module.exports = app;
