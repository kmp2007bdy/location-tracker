const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.send('Hello from Railway! Your app is working!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`✅ Test server is ready`);
});
