const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true,
    minlength: 8
  },
  time: {
    type: String
  },
  image: { type: mongoose.Schema.Types.ObjectId, ref: 'Image' },
  likes: [ { type: mongoose.Schema.Types.ObjectId, ref: 'Like' } ],
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }]
})

schema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Post', schema)
