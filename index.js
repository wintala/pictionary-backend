const express = require("express")
var cors = require('cors')
const http = require("http")
const socketio = require('socket.io')

const app = express()
app.use(cors())
const server = http.createServer(app)
const io = socketio(server, {
  cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST"]
  }
})


let games = []

const FinnishTurn = (game) => {
  clearInterval(game.interval)

  const quessedPlayers = game.players.filter(p => p.guessedCurrent).length
  if (quessedPlayers / (game.players.length - 1) > 0.49) {
    const drawer = game.players.find(p => p.id === game.turnPlayer)
    drawer.pointsCurrentRound = Math.ceil(game.players.length / 2)
    drawer.pointsTotal += drawer.pointsCurrentRound
  }

  const nextPlayer = game.players[game.players.map(p => p.id).indexOf(game.turnPlayer) + 1]

  if (nextPlayer) {
    game.turnPlayer = nextPlayer.id
  } else if (game.players.length !== 0) {
    game.turnPlayer = game.players[0].id
  }

  game.turnIndex += 1
  game.timeLeft = 0
}

const emitPubilcGameInfo = (io, game) => {
  const {currentWord, interval, ...publicGame} = game
  io.to(game.id).emit("gameInfo", publicGame)
}

const emitGameInfoWithWord = (io, game) => {
  const {interval, ...publicGame} = game
  io.to(game.id).emit("gameInfo", publicGame)
}

io.on("connection", (socket) => {
	console.log("Client connected")
	
  socket.on("disconnect", () => {
    const game = games.find(g => g.id === socket.gameRoom)

    if (game) {
      game.players = game.players.filter(p => p.id !== socket.id)
      if (game.players.length === 0) {
        games = games.filter(g => g.id !== game.id)
      } else {
        emitPubilcGameInfo(io, game)
      }
    }
    console.log("Client disconnected")
  })
  
  socket.on("mes", (message) => {
    const game = games.find(g => g.id === socket.gameRoom)

    if ((message === game.currentWord) && (game.timeLeft > 0) && !(socket.id === game.turnPlayer)) {
      const player = game.players.find(p => p.id === socket.id)

      if (!player.guessedCurrent) {
        player.guessedCurrent = true
        const quessedPlayers = game.players.filter(p => p.guessedCurrent).length
        player.pointsCurrentRound = game.players.length - quessedPlayers
        player.pointsTotal += player.pointsCurrentRound
        if (game.players.length  === quessedPlayers + 1) {
          FinnishTurn(game)
          emitGameInfoWithWord(io, game)
        } else {
          emitPubilcGameInfo(io, game)
        }
        io.to(socket.gameRoom).emit("mes", {message: "ARVASI SANAN OIKEIN", from: socket.username})
      }
    } else {
      io.to(socket.gameRoom).emit("mes", {message, from: socket.username})
    }
  })
  
  socket.on("cords", (cords) => {
    const game = games.find(g => g.id === socket.gameRoom)
    if (socket.id === game.turnPlayer) {
      socket.to(socket.gameRoom).emit("cords", cords) 
    }
  })
  
  socket.on("startCords", (cords) => {
    const game = games.find(g => g.id === socket.gameRoom)
    if (socket.id === game.turnPlayer) {
      socket.to(socket.gameRoom).emit("startCords", cords) 
    }
  })

  socket.on("clear", () => {
    const game = games.find(g => g.id === socket.gameRoom)
    if (socket.id === game.turnPlayer) {
      socket.to(socket.gameRoom).emit("clear") 
    }
  })

  socket.on("nextTurn", (word) => {
    if (!word) {
      return null
    }
    const game = games.find(g => g.id === socket.gameRoom)

    if (game.turnIndex >= game.maxTurns + 1 || game.turnPlayer !== socket.id) {
      return null
    }

    game.players = game.players.map(p => ({...p, guessedCurrent: false, pointsCurrentRound: 0}))
    game.currentWord = word
    game.timeLeft = game.timeLimit
    io.to(socket.gameRoom).emit("clear")
    emitPubilcGameInfo(io, game)

    const countDown = (game) => {
      game.timeLeft = game.timeLeft -1
      emitPubilcGameInfo(io, game)
    }

    game.interval = setInterval(() => countDown(game), 1000)
    setTimeout(() => {
      if (!game.interval._destroyed) { // jos kaikki arvanneet ennen ajan loppua
        FinnishTurn(game)
        emitGameInfoWithWord(io, game)
      }
    }, (game.timeLimit) * 1000)
  })

  socket.on("start", () => {
    const game = games.find(g => g.id === socket.gameRoom)
    console.log('here')
    if (socket.id === game.turnPlayer && game.turnIndex === 1) {
      game.started = true
      emitPubilcGameInfo(io, game) 
    }
  })

  socket.on("startOver", () => {
    const game = games.find(g => g.id === socket.gameRoom)

    if (game.turnIndex !== game.maxTurns) {
      return null
    }
    game.players = game.players.map(p => ({...p, pointsTotal:0, pointsCurrentRound: 0, guessedCurrent: false}))
    game.turnIndex = 1
    game.turnPlayer = game.players[0].id
    game.currentWord = ""
    clearInterval(game.interval)
    game.timeLeft = 0

    emitPubilcGameInfo(io, game)
  })

  
  socket.on("joinGame", (data) => {
    if (!data.name || !data.room) {
      return null
    }
    const game = games.find(g => g.id === data.room)
    if (game) {
      game.players = game.players.concat({id: socket.id, name: data.name, pointsTotal:0, pointsCurrentRound: 0, guessedCurrent: false})
      socket.username = data.name
      socket.gameRoom = data.room
      socket.join(data.room)
      emitPubilcGameInfo(io, game)
    }
	})

  socket.on("createGame", (data) => {
    if (!data.name || !data.timeLimit || !data.maxTurns) {
      return null
    }
    const game = {
      id: socket.id, 
      players: [{id: socket.id, name: data.name, pointsCurrentRound: 0, pointsTotal: 0, guessedCurrent: false}], 
      turnIndex: 1,
      turnPlayer: socket.id,
      currentWord: "",
      timeLimit: data.timeLimit,
      timeLeft: 0,
      maxTurns: data.maxTurns,
      started: false,
      interval: null
    }

    games = games.concat(game)
    socket.username = data.name
    socket.gameRoom = socket.id
    emitPubilcGameInfo(io, game)
	})
})

app.use(express.static("build"))
const PORT = process.env.PORT || 3001

server.listen(PORT, () => console.log("SERVER RUNNING"))  
