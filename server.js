const http = require('http');
const Gun = require('gun');
const express = require('express');

const app = express();
const port = process.env.PORT || 8080;

app.use(Gun.serve);
app.get('/', (req, res) => {
    res.status(200).send('Cyber Security Relay Online');
});

const server = http.createServer(app);

const gun = Gun({ 
    web: server,
    radisk: false, // Ephemeral storage for relay performance
    localStorage: false
});

server.listen(port, () => {
    console.log(`Relay server running on port ${port}`);
});
