const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/zafrandb')
  .then(() => console.log('MongoDB connected — ZafranGames live'))
  .catch(err => console.log(err));

const { router: authRouter } = require('./routes/auth');
app.use('/api/auth', authRouter);
app.use('/api/game', require('./routes/game'));
app.use('/api/payment', require('./routes/payment'));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ZafranGames running on port ${PORT}`));
