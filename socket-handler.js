
const {games, startGame, startOverGame, startTurn, finnishTurn, removePlayer, addPlayerToGame, wordHint, handleGuess, createGame} = require("./game.js")

const emitPubilcGameInfo = (io, game) => {
  const {currentWord, interval, ...publicGame} = game
  io.to(game.id).emit("gameInfo", publicGame)
}

const emitPublicGameInfoWithWord = (io, game) => {
  const {interval, ...publicGame} = game
	io.to(game.id).emit("gameInfo", publicGame)
}

const myTurn = (palyerId, gameId) => (palyerId === games[gameId].turnPlayer)


exports.createActions = (io) => {
	io.on("connection", (socket) => {
		console.log("Client connected")
		
		socket.on("disconnect", () => {
			const game = games[socket.gameRoom]
	
			if (game) {
				removePlayer(game, socket.id)
				emitPubilcGameInfo(io, game)
			}
			console.log("Client disconnected")
		})
		
		socket.on("mes", (message) => {
			const game = games[socket.gameRoom]

			const correctQuess = handleGuess(message, socket.id, game)

			if (correctQuess) {
				io.to(socket.gameRoom).emit("mes", {message: "ARVASI SANAN OIKEIN", from: socket.username})

				if (game.timeLeft === 0) { // eli kierros loppui kaikkien arvattua oikein
					emitPublicGameInfoWithWord(io, game)
				} else {
					emitPubilcGameInfo(io, game)
				}

			} else {
				io.to(socket.gameRoom).emit("mes", {message, from: socket.username})
			}
		})
		
		socket.on("cords", (cords) => {
			if (myTurn(socket.id, socket.gameRoom)) {
				socket.to(socket.gameRoom).emit("cords", cords) 
			}
		})
		
		socket.on("startCords", (cords) => {
			if (myTurn(socket.id, socket.gameRoom)) {
				socket.to(socket.gameRoom).emit("startCords", cords) 
			}
		})
	
		socket.on("clear", () => {
			if (myTurn(socket.id, socket.gameRoom)) {
				socket.to(socket.gameRoom).emit("clear") 
			}
		})
	
		socket.on("nextTurn", (word) => {
			const game = games[socket.gameRoom]
	
			if (game.turnIndex >= game.maxTurns + 1 || game.turnPlayer !== socket.id) {
				return null
			}

			startTurn(word, game)
			const hint = wordHint(game)
	
			socket.emit("word", game.currentWord)
			socket.to(socket.gameRoom).emit("word", hint)
	
			io.to(socket.gameRoom).emit("clear")
			emitPubilcGameInfo(io, game)
	
			const countDown = (game) => {
				game.timeLeft = game.timeLeft -1
				emitPubilcGameInfo(io, game)
			}
	
			game.interval = setInterval(() => countDown(game), 1000)
			setTimeout(() => {
				if (!game.interval._destroyed) { // jos kaikki arvanneet ennen ajan loppua
					finnishTurn(game)
					emitPublicGameInfoWithWord(io, game)
				}
			}, (game.timeLimit) * 1000)
		})
	
		socket.on("start", () => {
			const game = games[socket.gameRoom]
			if (socket.id === game.turnPlayer && game.turnIndex === 1) {
				startGame(game)
				emitPubilcGameInfo(io, game)
			}
		})
	
		socket.on("startOver", () => {
			const game = games[socket.gameRoom]
	
			if (game.turnIndex !== game.maxTurns + 1) {
				return null
			}
			startOverGame()
			emitPubilcGameInfo(io, game)
		})
	
		
		socket.on("joinGame", (data) => {
			if (!data.name || !data.room) {
				return null
			}
			const game = games[data.room]
			if (game) {
				addPlayerToGame(data.name, socket.id, game)
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
			const game = createGame(socket.id, data.name, data.timeLimit, data.maxTurns)
			socket.username = data.name
			socket.gameRoom = socket.id
			emitPubilcGameInfo(io, game)
		})
	})
}