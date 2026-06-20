const express = require('express');
const app = express();

// Base URL of your active streaming app on Firebase
const FIREBASE_APP_URL = "https://mid-night-anime.web.app";

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

// Root route helper
app.get('/', (req, res) => {
    res.redirect(FIREBASE_APP_URL);
});

// Dynamic route matching: /anilist/:id/EP/:epId
app.get('/anilist/:id/EP/:epId', async (req, res) => {
    const animeId = parseInt(req.params.id, 10);
    const epId = req.params.epId;

    // Fallback values if AniList is down or id is invalid
    let animeTitle = "Awesome Anime";
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
                    animeTitle = media.title.userPreferred || media.title.english || 'Anime';
                    imageUrl = media.coverImage.extraLarge || media.coverImage.large;
                    
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

    // NEW FORMAT: Redirects strictly to https://mid-night-anime.web.app/?a=ID&ep=EP
    const finalRedirectDestination = `${FIREBASE_APP_URL}/?a=${animeId}&ep=${epId}`;
    
    // NEW METADATA FORMAT: "Check Out Re:ZERO -Starting Life in Another World- Season 4 E1 on Midnight Anime!"
    const formattedShareTitle = `Check Out ${animeTitle} E${epId} on Midnight Anime!`;

    // Optimize headers for social media scrapers
    res.setHeader('Cache-Control', 's-maxage=1200, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'text/html');

    // Return HTML with static meta tags for WhatsApp
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${formattedShareTitle}</title>
            <meta name="description" content="${description}">

            <meta property="og:type" content="video.other">
            <meta property="og:site_name" content="Midnight Anime">
            <meta property="og:title" content="${formattedShareTitle}">
            <meta property="og:description" content="${description}">
            <meta property="og:image" content="${imageUrl}">
            <meta property="og:image:secure_url" content="${imageUrl}">
            <meta property="og:image:type" content="image/jpeg">
            <meta property="og:image:width" content="1200">
            <meta property="og:image:height" content="675">
            
            <meta http-equiv="refresh" content="0;url=${finalRedirectDestination}">

            <style>
                body { margin: 0; background-color: #020617; color: #f8fafc; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center; }
                .spinner { border: 4px solid #0f172a; border-top: 4px solid #6366f1; border-radius: 50%; width: 44px; height: 44px; animation: spin 0.8s linear infinite; margin: 0 auto 15px; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                h1 { font-size: 1.1rem; font-weight: 500; color: #cbd5e1; margin: 0; }
            </style>
        </head>
        <body>
            <div>
                <div class="spinner"></div>
                <h1>Opening Video Player...</h1>
            </div>
            <script>
                window.location.href = "${finalRedirectDestination}";
            </script>
        </body>
        </html>
    `);
});

module.exports = app;
