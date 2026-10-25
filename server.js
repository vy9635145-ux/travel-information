
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Vlog = require('./models/Vlog');

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const uploadsDir = process.env.VERCEL
  ? path.join('/tmp', 'uploads', 'videos')
  : path.join(__dirname, 'uploads', 'videos');

fs.mkdirSync(uploadsDir, { recursive: true });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded video files
app.use('/uploads/videos', express.static(uploadsDir));

// -------------------- HEALTH CHECK --------------------

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'Yatra AI' });
});

// -------------------- ADMIN AUTHENTICATION --------------------

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      error: 'Admin login required.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required.'
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired login token. Please log in again.'
    });
  }
}

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (
    !process.env.ADMIN_USERNAME ||
    !process.env.ADMIN_PASSWORD ||
    !process.env.JWT_SECRET
  ) {
    return res.status(500).json({
      error: 'Admin authentication is not configured in .env.'
    });
  }

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username !== process.env.ADMIN_USERNAME
  ) {
    return res.status(401).json({
      error: 'Invalid username or password.'
    });
  }

  try {
    // Supports either a bcrypt hash or a plain password in .env.
    const storedPassword = process.env.ADMIN_PASSWORD;
    const isBcryptHash = /^\$2[aby]\$/.test(storedPassword);

    const passwordMatches = isBcryptHash
      ? await bcrypt.compare(password, storedPassword)
      : password === storedPassword;

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Invalid username or password.'
      });
    }

    const token = jwt.sign(
      {
        role: 'admin',
        username: process.env.ADMIN_USERNAME
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.json({
      message: 'Admin login successful.',
      token,
      expiresIn: 7200
    });
  } catch (error) {
    console.error('Admin login error:', error.message);

    return res.status(500).json({
      error: 'Could not log in.'
    });
  }
});

// -------------------- GOOGLE PLACES SEARCH --------------------

async function searchGooglePlaces(textQuery) {
  const response = await fetch(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.location',
          'places.rating',
          'places.googleMapsUri',
          'places.types',
          'places.photos'
        ].join(',')
      },
      body: JSON.stringify({
        textQuery,
        languageCode: 'en',
        regionCode: 'IN',
        maxResultCount: 8
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      'Google Places search failed:',
      response.status,
      errorText
    );

    throw new Error(`Google Places returned HTTP ${response.status}`);
  }

  const data = await response.json();

  console.log(
    'Place photo summary:',
    (data.places || []).map(place => ({
      name: place.displayName?.text,
      photoCount: place.photos?.length || 0
    }))
  );

  return data.places || [];
}

function formatPlace(place) {
  const photo = place.photos?.[0];

  return {
    id: place.id,
    name: place.displayName?.text || 'Unnamed place',
    address: place.formattedAddress || '',
    rating: place.rating ?? null,
    types: place.types || [],
    mapsUrl: place.googleMapsUri || '',
    photoUrl: photo?.name
      ? `/api/places/photo?name=${encodeURIComponent(photo.name)}`
      : null,
    attributions: photo?.authorAttributions || []
  };
}

app.get('/api/places/search', async (req, res) => {
  const query = String(req.query.q || '').trim();

  if (!query || query.length > 150) {
    return res.status(400).json({
      error: 'Enter a place name of up to 150 characters.'
    });
  }

  if (!GOOGLE_API_KEY) {
    return res.status(500).json({
      error: 'Google Places API key is missing from the backend environment.'
    });
  }

  try {
    const places = await searchGooglePlaces(query);

    const cityTypes = [
      'locality',
      'postal_town',
      'administrative_area_level_1',
      'administrative_area_level_2',
      'administrative_area_level_3'
    ];

    const isCity = places.some(place =>
      (place.types || []).some(type => cityTypes.includes(type))
    );

    let attractions = [];

    if (isCity) {
      const attractionPlaces = await searchGooglePlaces(
        `top tourist attractions in ${query}, India`
      );

      attractions = attractionPlaces
        .filter(place => !places.some(item => item.id === place.id))
        .map(formatPlace);
    }

    const results = places.map(formatPlace);

    if (isCity && results[0] && !results[0].photoUrl) {
      const photoPlace = attractions.find(place => place.photoUrl);

      if (photoPlace) {
        results[0].photoUrl = photoPlace.photoUrl;
        results[0].attributions = photoPlace.attributions;
      }
    }

    return res.json({
      query,
      kind: isCity ? 'city' : 'place',
      results,
      attractions
    });
  } catch (error) {
    console.error('Place search error:', error.message);

    return res.status(502).json({
      error: 'Could not fetch places. Check the server terminal for details.'
    });
  }
});

// -------------------- GOOGLE PLACE PHOTOS --------------------

app.get('/api/places/photo', async (req, res) => {
  const name = String(req.query.name || '');

  if (!GOOGLE_API_KEY) {
    return res.status(500).send(
      'Google Places API key is not configured.'
    );
  }

  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) {
    return res.status(400).send('Invalid photo reference.');
  }

  try {
    const photoUrl = new URL(
      `https://places.googleapis.com/v1/${name}/media`
    );

    photoUrl.searchParams.set('maxWidthPx', '900');
    photoUrl.searchParams.set('key', GOOGLE_API_KEY);

    const response = await fetch(photoUrl);

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        'Google photo request failed:',
        response.status,
        errorText
      );

      return res.status(502).send('Unable to load this place photo.');
    }

    res.set(
      'Content-Type',
      response.headers.get('content-type') || 'image/jpeg'
    );
    res.set('Cache-Control', 'no-store');

    return res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('Photo loading failed:', error.message);

    return res.status(502).send('Unable to load this place photo.');
  }
});

// -------------------- VIDEO UPLOAD CONFIGURATION --------------------

const allowedMimeTypes = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v'
]);

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadsDir);
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new Error('Only MP4, WebM and MOV video files are allowed.')
      );
    }

    callback(null, true);
  }
});

// -------------------- CREATE VLOG (ADMIN ONLY) --------------------

app.post(
  '/api/vlogs',
  requireAdmin,
  upload.single('video'),
  async (req, res) => {
    let savedFilePath;

    try {
      const title = String(req.body.title || '').trim();
      const description = String(req.body.description || '').trim();
      const location = String(req.body.location || '').trim();

      if (!title || title.length > 200) {
        if (req.file) fs.unlink(req.file.path, () => {});

        return res.status(400).json({
          error: 'A title of 1–200 characters is required.'
        });
      }

      if (description.length > 5000 || location.length > 100) {
        if (req.file) fs.unlink(req.file.path, () => {});

        return res.status(400).json({
          error: 'Description or location exceeds the allowed length.'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'Please upload a video using the "video" field.'
        });
      }

      savedFilePath = req.file.path;

      const vlog = await Vlog.create({
        title,
        description,
        location,
        videoUrl: `/uploads/videos/${req.file.filename}`,
        originalFileName: path.basename(req.file.originalname)
      });

      return res.status(201).json({
        message: 'Vlog uploaded successfully.',
        vlog
      });
    } catch (error) {
      if (savedFilePath) fs.unlink(savedFilePath, () => {});

      console.error('Vlog upload error:', error.message);

      return res.status(500).json({
        error: 'Could not save the vlog.'
      });
    }
  }
);

// -------------------- LIST VLOGS (PUBLIC) --------------------

app.get('/api/vlogs', async (req, res) => {
  try {
    const vlogs = await Vlog.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      count: vlogs.length,
      vlogs
    });
  } catch (error) {
    console.error('Fetch vlogs error:', error.message);

    return res.status(500).json({
      error: 'Could not fetch vlogs.'
    });
  }
});

// -------------------- GET ONE VLOG (PUBLIC) --------------------

app.get('/api/vlogs/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid vlog ID.' });
  }

  try {
    const vlog = await Vlog.findById(req.params.id);

    if (!vlog) {
      return res.status(404).json({ error: 'Vlog not found.' });
    }

    return res.json({ vlog });
  } catch (error) {
    console.error('Fetch vlog error:', error.message);

    return res.status(500).json({
      error: 'Could not fetch this vlog.'
    });
  }
});

// -------------------- DELETE VLOG (ADMIN ONLY) --------------------

app.delete('/api/vlogs/:id', requireAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid vlog ID.' });
  }

  try {
    const vlog = await Vlog.findById(req.params.id);

    if (!vlog) {
      return res.status(404).json({ error: 'Vlog not found.' });
    }

    // Remove the database record first.
    await Vlog.findByIdAndDelete(req.params.id);

    const filename = path.basename(vlog.videoUrl || '');
    const videoPath = path.join(uploadsDir, filename);

    if (
      filename &&
      filename === vlog.videoUrl?.split('/').pop() &&
      fs.existsSync(videoPath)
    ) {
      await fs.promises.unlink(videoPath);
    }

    return res.json({
      message: 'Vlog deleted successfully.'
    });
  } catch (error) {
    console.error('Delete vlog error:', error.message);

    return res.status(500).json({
      error: 'Could not delete the vlog.'
    });
  }
});

// -------------------- ERROR HANDLER --------------------

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Video must be 100 MB or smaller.'
      : error.message;

    return res.status(400).json({ error: message });
  }

  if (error) {
    console.error('Request error:', error.message);

    return res.status(400).json({
      error: error.message || 'Request failed.'
    });
  }

  next();
});

// -------------------- FRONTEND FALLBACK --------------------

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------- START SERVER --------------------

async function startServer() {
  const requiredVariables = [
    'MONGODB_URI',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'JWT_SECRET'
  ];

  const missing = requiredVariables.filter(
    name => !process.env[name]
  );

  if (missing.length) {
    console.error('Missing .env variables:', missing.join(', '));
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET must be at least 32 characters long.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('MongoDB connected successfully.');

    app.listen(PORT, () => {
      console.log(`Yatra AI running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

startServer();
