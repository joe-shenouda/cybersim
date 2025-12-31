const express = require('express');
const path = require('path');
const app = express();

// Use the PORT environment variable provided by Render, or default to 3000
const port = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Send index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`CyberRange Server running on port ${port}`);
});
