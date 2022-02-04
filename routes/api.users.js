const { Router } = require('express')
const jwt = require('jsonwebtoken')
const md5 = require('md5')
const multer = require('multer')
const { getUser } = require('../src/util')
const util = require('../src/util')

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'forest/assets/avatars')
    },
    filename: function(req, file, cb) {
        console.log(file)
        cb(null, Math.floor(Date.now()/1000).toString(16) + genRanHex(24) + getExtension(file.originalname)) // 8 + 24 = 32
    }
})

const fileFilter = (req, file, cb) => {
    if(file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true)
    } else {
        cb(JSON.stringify("Files can only be the type of jpeg or png"), false)
    }
}

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5
    },
    fileFilter: fileFilter
})

module.exports.Router = class Routes extends Router {
    constructor() {
        super();

        // Root
        this.get('/', authToken, (req, res) => {
            if(req.user.isAdmin) {
                req.mysql.query('SELECT * FROM users', (err, resu) => {
                    return res.json(resu)
                })
            } else {
                return res.send({"message": "404: Not found"});
            }
           
        })

        // GET @me - shows information about the user with token in Authorization
        this.get('/@me', authToken, async (req, res) => {
            util.getUser(req.user.userId, (err, resu) => {
                const user = resu
                delete user.password, delete user.isVerified, delete user.isAdmin
                console.log(user)
                return res.json(user)
            })
            
        })

        // GET @me/avatar - returns the avatar of the user (if none, returns null)
        this.get('/@me/avatar', authToken, async (req, res) => {
            getUser(req.user.userId, (err, resu) => {
                if(err) return res.status(500).send(err)
                if(resu.avatar) res.sendFile(`${process.cwd()}/forest/assets/avatars/${resu.avatar}`, (err) => {
                    if(err) return res.send({"message": "There is no avatar available with this name. Please reupload your avatar."})
                })
                else res.sendStatus(404).send({"message": "There is no avatar present"})
                
            })
        })

        // PATCH @me - edit user profile
        this.patch('/@me', authToken, upload.single('avatar'), (req, res) => {
            if(!req.body.password) return res.status(401).send({"message": "Password required"})
            getUser(req.user.userId, (err, resu) => {
                if(err) return res.status(500).send(err)
                if(md5(req.body.password) !== resu.password) return res.status(401).send({"message": "Wrong password"})
                util.updateUser(req.user.id, req.body.username, req.file.filename, req.body.banner, req.body.banner_color, (isErr, err) => {
                    if(isErr) return res.sendStatus(500).send(err)
                    else res.sendStatus(200)
                })
            })
            
            
        })

        // :id - shows information about user with given id
        this.get('/:id', authToken, async (req, res) => {
            await req.mysql.query('SELECT * FROM users WHERE id = ?', [req.params.id], (err, resu) => {
                if (err) console.error(err)
                return res.send({
                    "id": resu[0].id, 
                    "username": resu[0].username, 
                    "avatar": resu[0].avatar,
                    "banner": resu[0].banner,
                    "banner_color": resu[0].banner_color
                })
            })
        });

        // @me/friends - shows an array of all friends that user with specified Authorization Token has
        this.get('/@me/friends', authToken, async (req, res) => {
            await req.mysql.query('SELECT * FROM friends WHERE user = ?', [req.user.id], (err, resu) => {
                res.json(resu)
            })
        });

        
    }
};

function authToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if(token == null) return res.sendStatus(401)

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if(err) return res.sendStatus(403)
        req.user = user
        next()
    })
}

function getExtension(filename) {
    var i = filename.lastIndexOf('.');
    return (i < 0) ? '' : filename.substr(i);
}

const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

module.exports.page = '/api/users';