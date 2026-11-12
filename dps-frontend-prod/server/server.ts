import express from 'express';

const app = express();
const PORT: number = parseInt(process.env['PORT'] as string, 10) || 8080;
const path = __dirname + '/app/';

// Serve static files with NO CACHING
app.use(express.static(path, {
  maxAge: 0,           // No caching
  etag: false,         // Disable etag
  lastModified: false  // Disable last modified
}));

// Add cache-busting headers to ALL responses
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.status(200).sendFile('index.html', { root: path });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
