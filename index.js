const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const mongoose = require('mongoose');

//Middleware
app.use(cors())
app.use(express.urlencoded({ extended: false })); // for x-www-form-urlencoded bodies
app.use(express.json()); // for JSON bodies if you need it
app.use(express.static('public'))

// Connect to Mongo
mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('Mongo connect error:', err.message));

// Schemas & Models
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true }
    // no "unique" here; FCC doesn't require uniqueness
  },
  { versionKey: false }
);

const exerciseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: { type: Date, required: true }
  },
  { versionKey: false }
);

const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

/**
 * 1) Create a new user
 * POST /api/users
 * Body: username
 * Response: { username, _id }
 */
app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'username is required' });
    }
    const user = await User.create({ username: username.trim() });
    // FCC expects string _id
    res.json({ username: user.username, _id: user._id.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create user' });
  }
});

/**
 * 2) Get all users
 * GET /api/users
 * Response: [ { username, _id }, ... ]
 */
app.get('/api/users', async (_req, res) => {
  try {
    const users = await User.find({}).select('username _id');
    res.json(users.map(u => ({ username: u.username, _id: u._id.toString() })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to fetch users' });
  }
});


/**
 * 3) Add exercise
 * POST /api/users/:_id/exercises
 * Body: description, duration, [date]
 * Response: {
 *   username, description, duration, date, _id
 * }
 */
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const { description, duration, date } = req.body;
    const userId = req.params._id;

    // 1. Find the user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 2. Format date (default: today if missing)
    const exerciseDate = date ? new Date(date) : new Date();
    if (isNaN(exerciseDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    // 3. Save exercise
    const exercise = await Exercise.create({
      userId: user._id,
      description,
      duration: parseInt(duration),
      date: exerciseDate
    });

    // 4. Respond in FCC format
    res.json({
      _id: user._id.toString(),
      username: user.username,
      date: exercise.date.toDateString(),
      duration: exercise.duration,
      description: exercise.description
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to add exercise' });
  }
});

/**
 * 4) Get user logs
 * GET /api/users/:_id/logs?[from][&to][&limit]
 * Response: {
 *   _id,
 *   username,
 *   count,
 *   log: [ { description, duration, date } ]
 * }
 */
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const { from, to, limit } = req.query;
    const userId = req.params._id;

    // 1. Find user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 2. Build query
    //let filter = { userId: userId };
    let filter = { userId };



    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    // 3. Fetch exercises
    let query = Exercise.find(filter).select("description duration date");
    if (limit) query = query.limit(parseInt(limit));

    const exercises = await query.exec();

    // 4. Format logs
    const log = exercises.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: ex.date.toDateString()
    }));

    // 5. Respond
    res.json({
      _id: user._id.toString(),
      username: user.username,
      count: log.length,
      log
    });
  } catch (err) {
  console.error("Error in GET /api/users/:_id/logs:", err.message);
  res.status(500).json({ error: err.message });
}
});


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
