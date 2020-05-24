const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    minlength: 8
  },
  time: {
    type: String,
    required: true
  },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
})

schema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Like', schema)
