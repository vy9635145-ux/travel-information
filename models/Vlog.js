
const mongoose = require('mongoose');

const vlogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      default: '',
      maxlength: 5000
    },
    location: {
      type: String,
      default: '',
      trim: true
    },
    videoUrl: {
      type: String,
      required: true
    },
    originalFileName: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Vlog', vlogSchema);
