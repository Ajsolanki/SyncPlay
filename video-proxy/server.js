const express = require('express');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;

// Enable CORS
// app.use(cors());
app.use(cors({
    origin: '*',  // Allow requests from any origin (adjust if necessary)
    methods: ['GET', 'POST', 'OPTIONS'],  // Specify allowed methods
    allowedHeaders: ['Content-Type']  // Allow specific headers if needed
}));

// process.on('uncaughtException', (err) => {
//     console.error('Uncaught exception:', err);
// });


// Serve static files from 'public' directory (your index.html)
app.use(express.static('public'));

// Proxy route to fetch Google Drive video
app.get('/proxy/video', async (req, res) => {
    const fileId = req.query.fileId;
    
    if (!fileId) {
        return res.status(400).json({ error: 'Missing fileId query parameter' });
    }

    try {
        // Fetch the video content from Google Drive
        const googleDriveURL = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const response = await axios({
            url: googleDriveURL,
            method: 'GET',
            responseType: 'stream',
        });

        // Forward the video stream to the client
        response.data.pipe(res);
    } catch (error) {
        if (error.response) {
            console.error(`Error fetching video: ${error.response.status} - ${error.response.statusText}`);
        } else {
            console.error('Error fetching video:', error.message);
        }
        res.status(500).json({ error: 'Failed to fetch video' });
    }    
});

// Create an HTTP server
const server = http.createServer(app);

// WebSocket server setup
const wss = new WebSocket.Server({ server });

// Shared video state
let videoState = {
    url: null,
    currentTime: 0,
    isPlaying: false,
    type: null // Type of video: YouTube or Google Drive
};

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New client connected');
    
    // Send the current video state to the newly connected client
    ws.send(JSON.stringify({ type: 'videoState', data: videoState }));

    // Handle incoming messages from the client
    ws.on('message', (message) => {
        const msg = JSON.parse(message);

        if (msg.type === 'updateState') {
            // Update the shared video state with data from the client
            videoState = {
                url: msg.data.url,
                currentTime: msg.data.currentTime,
                isPlaying: msg.data.isPlaying,
                type: msg.data.type
            };

            // Broadcast the updated state to all connected clients
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'videoState', data: videoState }));
                }
            });
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
    

    // When a client disconnects
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
