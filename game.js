const wordlist = require("./words.js")

const games = {} // global state
exports.games = games


exports.createGame = (id, name, timeLimit, maxTurns) => {
	const game = {
		id, 
		players: [{id, name, pointsCurrentRound: 0, pointsTotal: 0, guessedCurrent: false}], 
		turnIndex: 1,
		turnPlayer: id,
		currentWord: "",
		timeLimit,
		timeLeft: 0,
		maxTurns,
		started: false,
		interval: null
	}

	games[game.id] = game
	return game
}

const finnishTurn = (game) => {
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

exports.finnishTurn = finnishTurn

exports.startGame = (game) => {
	game.started = true
}

exports.startOverGame = (game) => {
	game.players = game.players.map(p => ({...p, pointsTotal: 0, pointsCurrentRound: 0, guessedCurrent: false}))
	game.turnIndex = 1
	game.turnPlayer = game.players[0].id
	game.currentWord = ""
	clearInterval(game.interval)
	game.timeLeft = 0
}

exports.addPlayerToGame = (name, id, game) => {
	game.players = game.players.concat({id, name, pointsTotal:0, pointsCurrentRound: 0, guessedCurrent: false})
}

exports.startTurn = (word, game) => {
	game.players = game.players.map(p => ({...p, guessedCurrent: false, pointsCurrentRound: 0}))
	game.timeLeft = game.timeLimit

	if (!word) {
		game.currentWord = wordlist.words[Math.floor(Math.random() * wordlist.words.length)]
	} else {
		game.currentWord = word
	}
}

exports.wordHint = (game) => {
	return game.currentWord.split("").map(char => char === " " ? "  " : "_ ").join("")
}

exports.removePlayer = (game, playerId) => {
	game.players = game.players.filter(p => p.id !== playerId)
	if (game.players.length === 0) {
		delete games[game.id]
	}
}

exports.handleGuess = (quess, playerId, game) => {
	if ((quess === game.currentWord) && (game.timeLeft > 0) && !(playerId === game.turnPlayer)) {
		const player = game.players.find(p => p.id === playerId)

		if (!player.guessedCurrent) {
			player.guessedCurrent = true
			const quessedPlayers = game.players.filter(p => p.guessedCurrent).length
			player.pointsCurrentRound = game.players.length - quessedPlayers
			player.pointsTotal += player.pointsCurrentRound

			if (game.players.length  === quessedPlayers + 1) {
				finnishTurn(game)
			}
		}
		return true
	} else {
		return false
	}
}
