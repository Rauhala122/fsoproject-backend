const { ApolloServer, UserInputError,makeExecutableSchema, gql, GraphQLUpload } = require('apollo-server-express')
const {GraphQLScalarType} = require("graphql")
const { PubSub } = require('apollo-server')
const pubsub = new PubSub()
const mongoose = require("mongoose")
require('dotenv').config()
const {createServer} =  require('http');
const User = require("./models/user")
const Post = require("./models/post")
const Comment = require("./models/comment")
const Message = require("./models/message")
const ProfilePicture = require("./models/profilePicture")
const Image = require("./models/image")
const Like = require("./models/like")
const bcrypt = require("bcrypt")
const fs = require('fs')
const multer = require('multer');
const cloudinary = require('cloudinary');
const path = require("path")
const express = require("express")

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: "794784574481144",
  api_secret: process.env.API_SECRET
});

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function(req, file, cb) {
    console.log(file)
    cb(null, file.originalname)
  }
})

const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.SECRET
console.log(JWT_SECRET)

mongoose.set('useFindAndModify', false)

const MONGODB_URI = process.env.MONGODB_URI

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connection to MongoDB:', error.message)
  })

let files = []

const typeDefs = gql`
  type File {
    id: ID!
    imageType: String
    imageUrl: String
    user: User
  }

  type User {
    id: ID!
    name: String!
    username: String!
    description: String!
    born: String!
    password: String!
    country: String!
    city: String!
    posts: [Post]
    likes: [Like]
    messages: [Message]
    profilePicture: File
  }

  scalar Upload

  type Post {
    id: ID!
    content: String!
    date: String!
    time: String!
    likes: [Like]
    user: User
    comments: [Comment]
    image: File
  }

  type Message {
    id: ID!
    message: String!
    date: String!
    user: User
  }

  type Comment {
    id: ID!
    post: Post!
    content: String!
    date: String!
    time: String!
    user: User
  }

  type Like {
    id: ID!
    user: User
    post: Post!
    date: String!
    time: String!
  }

  type Token {
    value: String!
  }

  type Query {
    userCount: Int!
    allUsers: [User!]!
    findUser(name: String!): User
    findPost(post: String): Post
    allPosts: [Post!]!
    allComments(post: String): [Comment!]!
    allMessages: [Message!]!
    me: User
    profilePictures: [File]
    files: [String]
  }

  type Subscription {
    postAdded: Post!
    messageAdded: Message!
  }

  type Mutation {
    singleUpload(file: Upload!): File!
    addPost(
      content: String!
      file: Upload
    ): Post
    addMessage(
      message: String!
    ): Message
    addComment(
      content: String!
      post: String!
    ): Comment
    addLike(
      post: String!
    ):Like
    unlike(
      post: String!
    ):Like
    deletePost(
      post: String!
    ): Post
    createUser(
      name: String!
      username: String!
      description: String!
      born: String!
      country: String!
      password: String!
      city: String!
    ): User
    changeUsername(
      user: String!
      newUsername: String!
    ):User
    changePassword(
      user: String!
      currentPassword: String!
      newPassword: String!
    ):User
    login(
      username: String!
      password: String!
    ): Token
  }

`

const currentTime = () => {
  const today = new Date();
  const date = `${today.getDate()}-${(today.getMonth()+1)}-${today.getFullYear()}`;
  const time = `${today.getHours()}:${(today.getMinutes()+1)}:${today.getSeconds()}`;
  return {date: new Date(), time: new Date()}
}

const resolvers = {
  Query: {
    userCount: () => User.collection.countDocuments(),
    allUsers: async () => {
      return await User.find({}).populate("posts")
    },
    findUser: (root, args) =>
      User.findOne({name: args.name}),
    findPost: (root, args) =>
      Post.findById(args.post),
    allPosts: async () => {
      return await Post.find({}).populate("user")
    },
    allComments: async (root, args) => {
      if (args.post) {
        return await Comment.find({post: args.post})
      }
      await Comment.deleteMany({})
      console.log("Comments", Comment.find({}))
      return await Comment.find({})
    },
    allMessages: async (root, args) => {
      return await Message.find({}).populate("user")
    },
    me: (root, args, context) => context.currentUser,
    profilePictures: (root, args, context) => ProfilePicture.find({}).populate("user"),
    files: (root, args, context) => files
  },
  Upload: GraphQLUpload,
  User: {
    posts: (root) => Post.find({user: root.id}),
    likes: (root) => Like.find({user: root.id}),
    profilePicture: (root) => ProfilePicture.findOne({user: root.id}),
    messages: (root) => Message.find({user: root.id})
  },
  Post: {
    user: (root) => {
      return User.findById(root.user)
    },
    comments: (root) => {
      return Comment.find({post: root.id})
    },
    likes: (root) => {
      return Like.find({post: root.id})
    },
    image: (root) => {
      return Image.findById(root.image)
    }
  },
  Comment: {
    post: (root) => {
      return Post.findById(root.post)
    },
    user: (root) => {
      return User.findById(root.user)
    }
  },
  Like: {
    user: (root) => {
      return User.findById(root.user)
    },
    post: (root) => {
      return Post.findById(root.post)
    },
  },
  Message: {
    user: (root) => {
      return User.findById(root.user)
    }
  },
  Mutation: {
    addMessage: async (root, args, context) => {
      const currentUser = context.currentUser

      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      if (!args.message) {
        throw new UserInputError("Cannot send empty message")
      }

      const newMessage = new Message({
        message: args.message,
        date: currentTime().date,
        user: currentUser._id
      })

      console.log("CUrentt user adding message", currentUser)
      console.log("New message", newMessage)

      try {
        await newMessage.save()
        currentUser.messages = currentUser.messages.concat(newMessage._id)
        await currentUser.save()
      } catch (error) {
          throw new UserInputError(error.message, {
            invalidArgs: args,
          })
      }

      pubsub.publish("MESSAGE_ADDED", { messageAdded: newMessage })

      return newMessage
    },
    singleUpload: async (_, { file }, context) => {
      const currentUser = context.currentUser
      console.log(currentUser)
      const {createReadStream, filename, mimetype, encoding} = await file
      const fileStream = createReadStream()

      console.log("CURRENT USER", currentUser)
      console.log("Path", fileStream.path)

      const uploader = await cloudinary.uploader.upload(
        fileStream.path,
        { public_id: `pictures/${filename}`, tags: `picture`,  eager: [
      { width: 300, height: 300, crop: "pad", audio_codec: "none" } ] }, // directory and tags are optional
        (err, image) => {
          console.log("IMAGE", image)
          if (err) throw new UserInputError(err)
          console.log('file uploaded to Cloudinary')
          // remove file from server
          fs.unlinkSync(fileStream.path)
          // return image details
          console.log("IMAGE", image)
        }
      )

      const url = await cloudinary.url(`${uploader.public_id}.${uploader.format}`, {secure: true, transformation: [
        {width: 500, height: 500, crop: "thumb"}
        ]})

      await new Promise(res =>
        fileStream.pipe(fs.createWriteStream(path.join(__dirname, "./images", filename)))
        .on("close", res)
      )

      files.push(filename)

      const newFile = new ProfilePicture({
        imageType: "profile_picture",
        imageUrl: url,
        user: currentUser._id
      })

      console.log("New file", newFile)

      if (currentUser.profilePicture) {
        console.log("ID of pic", currentUser.profilePicture)
        await ProfilePicture.findByIdAndRemove(currentUser.profilePicture)
        currentUser.profilePicture = newFile
        currentUser.save()
      } else {
        currentUser.profilePicture = newFile
        currentUser.save()
      }

      await newFile.save()

      return newFile;
    },
    addPost: async (root, args, context) => {
      const currentUser = context.currentUser
      console.log("POst args", args)

      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      let image = null;

      if (args.file) {
        const {createReadStream, filename, mimetype, encoding} = await args.file
        const fileStream = createReadStream()

        console.log("Path", fileStream.path)

        const uploader = await cloudinary.uploader.upload(
          fileStream.path,
          { public_id: `pictures/${filename}`, tags: `picture`,  eager: [
        { width: 300, height: 300, crop: "pad", audio_codec: "none" } ] }, // directory and tags are optional
          (err, image) => {
            console.log("IMAGE", image)
            if (err) throw new UserInputError(err)
            console.log('file uploaded to Cloudinary')
            // remove file from server
            fs.unlinkSync(fileStream.path)
            // return image details
            console.log("IMAGE", image)
          }
        )

        const url = await cloudinary.url(`${uploader.public_id}.${uploader.format}`, {secure: true})
        console.log("NEW IMAGE", url)

        const newFile = new Image({
          imageType: "profile_picture",
          imageUrl: url,
          user: currentUser._id
        })
        console.log("New file", newFile)
        await newFile.save()
        image = newFile._id
      }

      const post = new Post({
        content: args.content,
        date: currentTime().date,
        time: currentTime().time,
        user: currentUser._id,
        image: image
      })

      console.log("NEW POST", post)

      try {
        post.save().then(async response => {
          console.log('note saved!')
          console.log("USER before adding post", currentUser.posts)
          currentUser.posts = currentUser.posts.concat(post._id)
          console.log("USER posts after adding post", currentUser.posts)
          await currentUser.save()
        })
      } catch (error) {
          throw new UserInputError(error.message, {
            invalidArgs: args,
          })
      }

      pubsub.publish("POST_ADDED", { postAdded: post })

      return post
    },
    addLike: async (root, args, context) => {
      const currentUser = context.currentUser
      const post = await Post.findById(args.post)

      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      if (post.likes.some((val) => currentUser.likes.indexOf(val) !== -1)) {
        throw new UserInputError("You have already liked this post")
      }

      if (!post) {
        throw new UserInputError("Cannot like post that doesn't exist")
      }

      if (post.user.toString() === currentUser._id.toString()) {
        throw new UserInputError("Cannot like your own post")
      }

      const like = new Like({
        user: currentUser._id,
        post: post,
        date: currentTime().date,
        time: currentTime().time
      })
      console.log("POST Before like", post)

      try {
        await like.save()
        post.likes = post.likes.concat(like._id)
        currentUser.likes = currentUser.likes.concat(like._id)
        await currentUser.save()
        console.log("POST AFTER LIKE", post)
        await post.save()
      } catch (error) {
          throw new UserInputError(error.message, {
            invalidArgs: args,
          })
      }

      return like
    },
    unlike: async (root, args, context) => {
      const currentUser = context.currentUser
      const like = await Like.findOne({user: currentUser.id})
      const post = await Post.findById(args.post)

      post.likes = post.likes.filter(l => l.toString() !== like.id)

      console.log("Like", like)

      const indexOfRemovedLike = currentUser.likes.findIndex((l) => {
        return l.toString() === like._id.toString()
      })

      if (indexOfRemovedLike !== -1) {
        currentUser.likes.splice(indexOfRemovedLike, 1)
        await currentUser.save()
      }

      await post.save()
      await Like.findByIdAndRemove(like.id)
      return like
    },
    addComment: async (root, args, context) => {
      const currentUser = context.currentUser
      const post = await Post.findById(args.post)

      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      if (!args.content) {
        throw new UserInputError("Cannot add empty comment")
      }

      const comment = new Comment({
        content: args.content,
        post: post,
        user: currentUser._id,
        date: currentTime().date,
        time: currentTime().time
      })

      console.log("COMMENT", comment)
      console.log("POST", post)
      try {
        await comment.save()
        post.comments = post.comments.concat(comment._id)
        await post.save()
        console.log("Post with comment", post)
      } catch (error) {
          throw new UserInputError(error.message, {
            invalidArgs: args,
          })
      }

      return comment
    },
    deletePost: async (root, args, context) => {
      const currentUser = context.currentUser
      const post = await Post.findById(args.post)
      const userOfPost = post.user

      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      if (currentUser.id !== String(userOfPost)) {
        console.log("ERROROOR")
        throw new UserInputError("Cannot delete posts that you haven't created")
      }

      const indexOfRemovedPost = currentUser.posts.findIndex((p) => {
        return p.toString() === post._id.toString()
      })

      if (indexOfRemovedPost !== -1) {
        currentUser.posts.splice(indexOfRemovedPost, 1)
        await currentUser.save()
      }

      await Post.findByIdAndRemove(args.post)

      return post
    },
    changeUsername: async (root, args, context) => {
      const currentUser = context.currentUser
      const userToChange = await User.findById(args.user)

      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      if (currentUser.id !== userToChange.id) {
        throw new UserInputError("Cannot change other user's username")
      }

      currentUser.username = args.newUsername
      console.log(currentUser)
      await currentUser.save()

      return currentUser
    },
    changePassword: async (root, args, context) => {
      const currentUser = context.currentUser
      const userToChange = await User.findById(args.user)

      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      if (currentUser.id !== userToChange.id) {
        throw new UserInputError("Cannot change other user's password")
      }

      const passwordCorrect = userToChange === null
      ? false
      : await bcrypt.compare(args.currentPassword, userToChange.passwordHash)

      if (!(userToChange && passwordCorrect)) {
        throw new UserInputError("Wrong user or password")
      }

      const saltRounds = 10
      const passwordHash = await bcrypt.hash(args.newPassword, saltRounds)

      currentUser.passwordHash = passwordHash
      await currentUser.save()

      return currentUser
    },
    createUser: async (root, args) => {
      const saltRounds = 10
      const passwordHash = await bcrypt.hash(args.password, saltRounds)
      const user = new User({...args, passwordHash})

      console.log("User count")
      if (!(await User.findOne({username: args.username})) && User.find({}) === undefined) {
        throw new UserInputError("This username has already been taken")
      }

      if (args.password.length < 8) {
        throw new UserInputError("Password has to be at least 8 characters long")
      }

      try {
        await user.save()
      } catch (error) {
        throw new UserInputError(error.message, {
            invalidArgs: args,
          })
      }
      return user
    },
    login: async (root, args) => {
      const user = await User.findOne({username: args.username})
      console.log(user)
      const passwordCorrect = user === null
      ? false
      : await bcrypt.compare(args.password, user.passwordHash)

      if (!(user && passwordCorrect)) {
        throw new UserInputError("Wrong username or password")
      }

      const userForToken = {
        username: user.username,
        id: user._id
      }

      return {  value: jwt.sign(userForToken, JWT_SECRET) }
    }
  },
  Subscription: {
    postAdded: {
      subscribe: () => pubsub.asyncIterator(['POST_ADDED'])
    },
    messageAdded: {
      subscribe: () => pubsub.asyncIterator(['MESSAGE_ADDED'])
    }
  },
}

const schema = makeExecutableSchema({typeDefs, resolvers})

const server = new ApolloServer({
  schema,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), JWT_SECRET
      )
      const currentUser = await User
        .findById(decodedToken.id)
      return { currentUser }
    }
  }
})

const PORT = process.env.PORT || 4000

const app = express()
app.use("/images", express.static(path.join(__dirname, "./images")))
server.applyMiddleware({app})

const httpServer = createServer(app)
server.installSubscriptionHandlers(httpServer);

httpServer.listen({port: PORT}, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`)
  console.log(`🚀 Subscriptions ready at ws://localhost:${PORT}${server.subscriptionsPath}`)
})
