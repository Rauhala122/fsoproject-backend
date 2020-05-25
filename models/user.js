const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')


const schema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 3
  },
  description: {
    type: String,
    required: true,
    minlength: 5
  },
  passwordHash: {
    type: String,
    required: true,
    minlength: 7
  },
  born: {
    type: String,
    required: true,
    minlength: 8
  },
  country: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3
  },
  posts: [ { type: mongoose.Schema.Types.ObjectId, ref: 'Post' } ],
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  likes: [ { type: mongoose.Schema.Types.ObjectId, ref: 'Like' } ],
  profilePicture: { type: mongoose.Schema.Types.ObjectId, ref: 'ProfilePicture' }
})

schema.plugin(uniqueValidator)

schema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
    delete returnedObject.passwordHash
  }
})

module.exports = mongoose.model('User', schema)
