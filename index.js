const express = require("express")
var cors = require('cors')
const http = require("http")
const socketio = require('socket.io')
const socketHandler = require("./socket-handler.js")

const app = express()
app.use(cors())
const server = http.createServer(app)
const io = socketio(server, {
  cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST"]
  }
})

socketHandler.createActions(io)
console.log('here')

app.use(express.static("build"))
const PORT = process.env.PORT || 3001

server.listen(PORT, () => console.log("SERVER RUNNING"))  
